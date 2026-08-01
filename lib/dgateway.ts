import "server-only";

/**
 * DGateway (MTN Mobile Money + Airtel Money, UGX) client.
 *
 * No dgateway-guide.md ships with this project, so the exact endpoint
 * shapes below are a best-effort generic implementation of the standard
 * "collect → poll status" / "payout → poll status" pattern used by most
 * African mobile money aggregators. When real API docs are available,
 * only the fetch calls inside this file need to change — every caller in
 * the app depends solely on the function signatures exported here.
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
  const apiUrl = process.env.DGATEWAY_API_URL;
  const apiKey = process.env.DGATEWAY_API_KEY;
  if (!apiUrl || !apiKey) return null;
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

export function isDGatewayConfigured(): boolean {
  return getConfig() !== null;
}

/** Collects a payment FROM a member's mobile money wallet (loan repayment). */
export async function collectPayment(params: {
  phone: string;
  amountUgx: number;
  reference: string;
  narration?: string;
}): Promise<DGatewayResult> {
  const config = getConfig();
  if (!config) {
    throw new Error("DGateway is not configured (set DGATEWAY_API_URL and DGATEWAY_API_KEY)");
  }

  const res = await fetch(`${config.apiUrl}/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      phoneNumber: params.phone,
      amount: params.amountUgx,
      currency: "UGX",
      reference: params.reference,
      narration: params.narration ?? "Nexcgen loan repayment",
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? `DGateway collection request failed (${res.status})`);
  }

  return { transactionRef: body.reference ?? params.reference, status: "pending" };
}

/** Pays out TO a member's mobile money wallet (loan disbursement). */
export async function disburse(params: {
  phone: string;
  amountUgx: number;
  reference: string;
  narration?: string;
}): Promise<DGatewayResult> {
  const config = getConfig();
  if (!config) {
    throw new Error("DGateway is not configured (set DGATEWAY_API_URL and DGATEWAY_API_KEY)");
  }

  const res = await fetch(`${config.apiUrl}/payouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      phoneNumber: params.phone,
      amount: params.amountUgx,
      currency: "UGX",
      reference: params.reference,
      narration: params.narration ?? "Nexcgen loan disbursement",
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? `DGateway payout request failed (${res.status})`);
  }

  return { transactionRef: body.reference ?? params.reference, status: "pending" };
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
 */
export async function getTransactionStatus(reference: string): Promise<DGatewayResult> {
  const config = getConfig();
  if (!config) {
    throw new Error("DGateway is not configured (set DGATEWAY_API_URL and DGATEWAY_API_KEY)");
  }

  const res = await fetch(`${config.apiUrl}/transactions/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? `DGateway status check failed (${res.status})`);
  }

  return { transactionRef: reference, status: normalizeStatus(body.status), message: body.message };
}
