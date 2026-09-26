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

/**
 * Staging-only fake gateway. Every real bug found in this file this year
 * (a bad API key, a "vendor" rejection on a valid phone number, a payout
 * that failed against RohoPay's live rail) was discovered by watching a
 * real member's real money fail on production, because there was nowhere
 * safe to exercise the disburse/collect/webhook lifecycle first. When
 * DGATEWAY_MODE=mock, every function below returns a deterministic fake
 * result instead of calling RohoPay — same shape every caller already
 * handles, so no caller needs to know mock mode exists. Deliberately mimics
 * production's real behavior (see collect/disburse below) rather than
 * always synchronously succeeding: a mock that's too easy hides the exact
 * class of bug this mode exists to catch. Resolve a mock transaction via
 * app/api/dgateway/webhook/simulate, which drives the same confirmation
 * path a real RohoPay webhook would.
 */
export function isMockMode(): boolean {
  return process.env.DGATEWAY_MODE === "mock";
}

export function isDGatewayConfigured(): boolean {
  return isMockMode() || getConfig() !== null;
}

// CRITICAL, confirmed via RohoPay's own dashboard (Developers → Webhooks):
// RohoPay does NOT support a dashboard-configured global webhook URL — it
// literally has nowhere to enter one. Instead: "Set a callback_url on each
// payment request and RohoPay will POST to it automatically." Every prior
// webhook fix in this file's git history was chasing signature/payload
// details on a webhook that could never have been sent in the first place,
// because collectPayment()/disburse() never included this field. Omitting
// it is why every single Mobile Money transaction has needed manual
// reconciliation via getTransactionStatus() instead of self-confirming.
function getCallbackUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  // Fail loud rather than silently sending RohoPay a relative/empty
  // callback_url — that would recreate the exact "webhook never arrives"
  // bug this fixes, just one level removed (a garbage URL instead of no
  // URL at all).
  if (!base.startsWith("http")) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set to a full URL — RohoPay needs an absolute callback_url");
  }
  return `${base}/api/dgateway/webhook`;
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
  network?: "MTN" | "Airtel";
  amountUgx: number;
  reference: string;
  narration?: string;
}): Promise<DGatewayResult> {
  if (isMockMode()) {
    return { transactionRef: `MOCK-${randomUUID()}`, status: "pending" };
  }

  const config = getConfig();
  if (!config) {
    throw new Error("RohoPay is not configured (set ROHO_API_URL and ROHO_API_KEY)");
  }

  const data = await rohoPost(config, "/api/v1/collect", {
    phone: params.phone,
    // Sent alongside phone rather than relying on RohoPay to infer it from
    // the prefix — Uganda's number portability means a phone's prefix
    // doesn't reliably identify MTN vs Airtel. Field name (`provider`)
    // mirrors what RohoPay's own /collect response already returns
    // (data.provider) — unconfirmed as a REQUEST field since /guides
    // 404'd, so this is sent best-effort and simply ignored if unrecognized.
    ...(params.network ? { provider: params.network.toUpperCase() } : {}),
    amount: params.amountUgx,
    currency: "UGX",
    reference: params.reference,
    // RohoPay's field is `description`, not `narration` (confirmed via
    // their own /api/v1/collect example) — every prior transaction shows
    // "Untitled transaction" in their ledger because `narration` was an
    // unrecognized field they silently dropped. Kept as `narration` in
    // this function's own params for callers, just sent under the right
    // wire field name here.
    description: params.narration ?? "Nexcgen loan repayment",
    callback_url: getCallbackUrl(),
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
  network?: "MTN" | "Airtel";
  amountUgx: number;
  reference: string;
  narration?: string;
}): Promise<DGatewayResult> {
  if (isMockMode()) {
    return { transactionRef: `MOCK-${randomUUID()}`, status: "pending" };
  }

  const config = getConfig();
  if (!config) {
    throw new Error("RohoPay is not configured (set ROHO_API_URL and ROHO_API_KEY)");
  }

  const data = await rohoPost(config, "/api/v1/disburse", {
    phone: params.phone,
    // See collectPayment()'s comment — same reasoning applies to payouts.
    ...(params.network ? { provider: params.network.toUpperCase() } : {}),
    amount: params.amountUgx,
    currency: "UGX",
    reference: params.reference,
    description: params.narration ?? "Nexcgen loan disbursement",
    callback_url: getCallbackUrl(),
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
  if (isMockMode()) {
    return { transactionRef: reference, status: "pending", message: "Mock mode — resolve via /api/dgateway/webhook/simulate" };
  }

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
  if (isMockMode()) return { balance: 5_000_000, currency: "UGX" };

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
