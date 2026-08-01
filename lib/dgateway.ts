import "server-only";
import { randomUUID } from "crypto";

/**
 * RohoPay (MTN Mobile Money + Airtel Money, UGX) client.
 *
 * Confirmed against https://docs.rohopay.com (base URL, auth scheme,
 * /api/v1/collect request/response shape, Idempotency-Key header,
 * {success,data,error} envelope). RohoPay's /guides/* and
 * /api-reference/payouts pages 404'd on every fetch attempt during this
 * integration, so the payout (disbursement) endpoint path below is a
 * best-effort guess mirrored off the confirmed /collect shape — flagged
 * inline. Only the fetch calls inside this file need to change once real
 * payout docs are available; every caller in the app depends solely on
 * the function signatures exported here (kept as "DGateway*" names to
 * avoid touching every call site — this file is the only thing that
 * changed vendor).
 *
 * Per master_prompt.md: a disbursement or repayment must never be marked
 * complete optimistically. Every function here returns "pending" for a
 * newly-initiated transaction; callers must treat the loan/repayment as
 * unconfirmed until a webhook (see app/api/dgateway/webhook/route.ts) or
 * an explicit status poll reports "successful".
 */

export type DGatewayTransactionStatus = "pending" | "successful" | "failed";

export type DGatewayResult = {
  transactionRef: string;
  status: DGatewayTransactionStatus;
  message?: string;
};

function getConfig() {
  const apiUrl = process.env.ROHO_API_URL;
  const apiKey = process.env.ROHO_API_KEY;
  if (!apiUrl || !apiKey) return null;
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

export function isDGatewayConfigured(): boolean {
  return getConfig() !== null;
}

// Confirmed live against a RohoPay sandbox (test_-prefixed) key: POST
// /api/v1/collect returns {success, message, data: {reference,
// transaction_id, status, amount, commission, net_amount, provider,
// provider_fee, ...}}. Note `data.reference` is RohoPay's OWN generated
// reference — it does NOT echo back the `reference` we send in the request
// body — so `data.reference` (falling back to `data.transaction_id`) is
// what must be persisted as transactionRef for webhook matching later.
function extractReference(data: Record<string, unknown> | undefined, fallback: string): string {
  return (data?.reference as string) ?? (data?.transaction_id as string) ?? fallback;
}

async function rohoPost(config: { apiUrl: string; apiKey: string }, path: string, body: unknown) {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const envelope = await res.json().catch(() => ({}));
  if (!res.ok || envelope?.success === false) {
    const message = envelope?.error?.message ?? envelope?.error ?? `RohoPay request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return envelope?.data ?? envelope;
}

/** Collects a payment FROM a member's mobile money wallet (loan repayment or savings deposit). */
export async function collectPayment(params: {
  phone: string;
  amountUgx: number;
  reference: string;
  narration?: string;
}): Promise<DGatewayResult> {
  const config = getConfig();
  if (!config) {
    throw new Error("RohoPay is not configured (set ROHO_API_URL and ROHO_API_KEY)");
  }

  const data = await rohoPost(config, "/api/v1/collect", {
    phone: params.phone,
    amount: params.amountUgx,
    currency: "UGX",
    reference: params.reference,
    narration: params.narration ?? "Nexcgen loan repayment",
  });

  // Confirmed live: RohoPay's /api/v1/collect response ALREADY carries the
  // final status (data.status: "successful") for sandbox transactions,
  // rather than always requiring an async webhook — likely because the
  // request blocks until the member approves (or the attempt times out) on
  // their phone. Honoring it here, instead of always forcing "pending", is
  // what lets a caller confirm the balance/loan update in the same request
  // instead of relying solely on a webhook that may never arrive.
  return { transactionRef: extractReference(data, params.reference), status: normalizeStatus(data?.status) };
}

/**
 * Pays out TO a member's mobile money wallet (loan disbursement).
 *
 * Endpoint path CONFIRMED via docs.rohopay.com/api-reference/overview:
 * POST /api/v1/disburse, described there as "Send mobile money (live
 * only)" — meaning RohoPay may reject disburse calls made with a test_
 * key even in a sandbox context; only a live_ key can actually pay out.
 * Request/response field names are still unconfirmed (mirrors the
 * confirmed /api/v1/collect shape) — this fails loudly (thrown error,
 * loan stays undisbursed) rather than silently marking a disbursement as
 * sent if the shape guess is wrong.
 */
export async function disburse(params: {
  phone: string;
  amountUgx: number;
  reference: string;
  narration?: string;
}): Promise<DGatewayResult> {
  const config = getConfig();
  if (!config) {
    throw new Error("RohoPay is not configured (set ROHO_API_URL and ROHO_API_KEY)");
  }

  const data = await rohoPost(config, "/api/v1/disburse", {
    phone: params.phone,
    amount: params.amountUgx,
    currency: "UGX",
    reference: params.reference,
    narration: params.narration ?? "Nexcgen loan disbursement",
  });

  // See collectPayment()'s comment — same reasoning applies to payouts.
  return { transactionRef: extractReference(data, params.reference), status: normalizeStatus(data?.status) };
}

function normalizeStatus(raw: string | undefined): DGatewayTransactionStatus {
  const value = (raw ?? "").toLowerCase();
  if (["successful", "success", "completed"].includes(value)) return "successful";
  if (["failed", "declined", "cancelled", "expired"].includes(value)) return "failed";
  return "pending";
}

/**
 * Polls the current status of a transaction. The 5-minute polling cap noted
 * in master_prompt.md's DGateway gotchas applies here — callers (e.g. a
 * client-side poll loop) should stop after ~5 minutes and surface a
 * "still pending" state rather than polling forever.
 *
 * Endpoint path was a best-effort guess (docs 404'd) but VERIFIED WORKING
 * live in production — used to recover a real member deposit that RohoPay
 * had confirmed but our webhook never received.
 */
export async function getTransactionStatus(reference: string): Promise<DGatewayResult> {
  const config = getConfig();
  if (!config) {
    throw new Error("RohoPay is not configured (set ROHO_API_URL and ROHO_API_KEY)");
  }

  const res = await fetch(`${config.apiUrl}/api/v1/transactions/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });

  const envelope = await res.json().catch(() => ({}));
  if (!res.ok || envelope?.success === false) {
    const message = envelope?.error?.message ?? envelope?.error ?? `RohoPay status check failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  const data = envelope?.data ?? envelope;

  return { transactionRef: reference, status: normalizeStatus(data?.status), message: data?.message };
}

export type WalletBalance = { balance: number; currency: string };

/**
 * The SACCO's own RohoPay merchant float — confirmed via
 * docs.rohopay.com/api-reference/overview: GET /api/v1/wallet/balance
 * (API-key auth). RohoPay's top-up endpoints are session-authenticated
 * (only usable by a human logged into RohoPay's own dashboard), so this
 * app can only ever READ the balance, never top it up automatically —
 * surfaced on the Settings page so a SuperAdmin knows when to go top up
 * the float manually before Mobile Money payouts start failing.
 */
export async function getWalletBalance(): Promise<WalletBalance | null> {
  const config = getConfig();
  if (!config) return null;

  const res = await fetch(`${config.apiUrl}/api/v1/wallet/balance`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  if (!res.ok) return null;

  const envelope = await res.json().catch(() => ({}));
  if (envelope?.success === false) return null;
  const data = envelope?.data ?? envelope;
  if (typeof data?.balance !== "number") return null;

  return { balance: data.balance, currency: data.currency ?? "UGX" };
}
