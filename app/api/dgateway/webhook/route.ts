import {
  confirmSavingsDeposit,
  failSavingsDeposit,
  confirmRepayment,
  failRepayment,
  confirmDisbursement,
  failDisbursement,
} from "@/lib/payment-confirmation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";

// RohoPay confirms HMAC-SHA256 webhook signatures but docs.rohopay.com's
// /guides/* pages (which would name the exact header + payload shape)
// 404'd on every fetch attempt during this integration (see lib/dgateway.ts
// header comment). This checks both commonly-used header names against an
// HMAC-SHA256 of the raw body — if RohoPay uses a different header, every
// real webhook will 401 (fails closed / loudly, never silently accepts an
// unverified event) until the header name is corrected here.
const SIGNATURE_HEADER_CANDIDATES = ["x-roho-signature", "x-webhook-signature", "x-signature"];

function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.ROHO_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");

  for (const headerName of SIGNATURE_HEADER_CANDIDATES) {
    const provided = headers.get(headerName);
    if (!provided) continue;
    const providedBuf = Buffer.from(provided, "utf8");
    if (providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

// Payload field names are likewise unconfirmed (webhook docs 404'd), but
// data.reference/data.transaction_id/data.status are CONFIRMED live as the
// /api/v1/collect response's field names (see lib/dgateway.ts) — webhooks
// most likely reuse the same {success,data,error} envelope and field names,
// so those are checked first, with a flat top-level shape as a fallback.
const webhookSchema = z.object({
  reference: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  type: z.enum(["collection", "payout"]).optional(),
  event: z.string().optional(),
  data: z
    .object({
      reference: z.string().optional(),
      transaction_id: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

/**
 * Async confirmation path for Mobile Money transactions. This is now the
 * SECONDARY confirmation path — the primary one is the initiating route
 * (savings deposit / repay / disburse) honoring RohoPay's own synchronous
 * response status via lib/payment-confirmation.ts. This webhook exists for
 * cases the synchronous response can't cover: the member takes longer than
 * the request's lifetime to approve on their phone, a network blip loses
 * the synchronous response after RohoPay already processed it, etc. Both
 * paths call the same confirm/fail functions, which only ever act on a
 * still-Pending record, so whichever arrives first "wins" and the second is
 * a harmless no-op.
 */
export async function POST(req: Request) {
  // Fail CLOSED: this endpoint moves real money state (creates loans,
  // confirms repayments) — an unset secret must reject every request, not
  // silently trust whatever is posted to it.
  if (!process.env.ROHO_WEBHOOK_SECRET) {
    console.error("[dgateway/webhook] ROHO_WEBHOOK_SECRET is not set — refusing all requests");
    return NextResponse.json({ error: "Server misconfigured: ROHO_WEBHOOK_SECRET not set" }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });

  const reference = parsed.data.data?.reference ?? parsed.data.data?.transaction_id ?? parsed.data.reference;
  const rawStatus = (parsed.data.status ?? parsed.data.data?.status ?? "").toLowerCase();
  const successful = ["successful", "success", "completed"].includes(rawStatus);
  const type: "collection" | "payout" =
    parsed.data.type ?? (parsed.data.event?.toLowerCase().includes("payout") ? "payout" : "collection");

  if (!reference) return NextResponse.json({ error: "Invalid webhook payload: missing reference" }, { status: 400 });

  if (type === "payout") {
    const result = successful ? await confirmDisbursement(reference, req) : await failDisbursement(reference, req);
    if (!result.ok) return NextResponse.json({ error: "No matching disbursement" }, { status: 404 });
    return NextResponse.json({ acknowledged: true });
  }

  // A "collection" reference is either a loan repayment or a savings
  // deposit — try savings first (its reference prefix, NGS-SDEP-, is
  // distinct from a repayment's NGS-MRPY-), but match by lookup either way
  // rather than trusting the prefix string.
  const savingsResult = successful ? await confirmSavingsDeposit(reference, req) : await failSavingsDeposit(reference, req);
  if (savingsResult.ok) return NextResponse.json({ acknowledged: true });

  const repaymentResult = successful ? await confirmRepayment(reference, req) : await failRepayment(reference, req);
  if (!repaymentResult.ok) return NextResponse.json({ error: "No matching transaction" }, { status: 404 });
  return NextResponse.json({ acknowledged: true });
}
