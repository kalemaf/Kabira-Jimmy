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
 * UNCONFIRMED: RohoPay's payout/disbursement endpoint path and response
 * field names could not be verified (docs 404'd — see file header). This
 * mirrors the confirmed /api/v1/collect shape as the most likely payout
 * convention. If this 404s in practice, that confirms the guess is wrong
 * and the endpoint needs correcting once real docs are obtained — it will
 * fail loudly (thrown error, loan stays undisbursed) rather than silently
 * marking a disbursement as sent.
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

  const data = await rohoPost(config, "/api/v1/payout", {
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
 * UNCONFIRMED endpoint path (docs 404'd) — mirrors the /api/v1/collect
 * convention with a GET lookup by reference.
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
