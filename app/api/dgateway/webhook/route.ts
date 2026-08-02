import {
  confirmSavingsDeposit,
  failSavingsDeposit,
  confirmSavingsWithdrawal,
  failSavingsWithdrawal,
  confirmRepayment,
  failRepayment,
  confirmDisbursement,
  failDisbursement,
} from "@/lib/payment-confirmation";
import { sendCriticalAlert } from "@/lib/alert";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";

// CONFIRMED via docs.rohopay.com/core-concepts/webhooks: header
// "X-RohoPay-Signature", value format "sha256=<hex digest of the raw
// request body>", secret from RohoPay Dashboard → Webhooks (must match
// ROHO_WEBHOOK_SECRET exactly — it is NOT the same value as ROHO_API_KEY).
function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.ROHO_WEBHOOK_SECRET;
  if (!secret) return false;

  const provided = headers.get("x-rohopay-signature");
  if (!provided || !provided.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}

// CONFIRMED payload shape (flat, not nested under `data`) — verified
// against RohoPay's own dashboard docs (docs-page scrape AND a dashboard
// code sample both use `internal_reference`; one other code sample used a
// plain `reference` instead). All candidate field names are tried against
// pending records, in order, so this is correct regardless of which one a
// real payload actually uses — the order below is just which is tried
// first.
const webhookSchema = z.object({
  event: z.enum(["deposit.successful", "deposit.failed", "withdraw.successful", "withdraw.failed"]),
  internal_reference: z.string().optional(),
  reference: z.string().optional(),
  id: z.string().optional(),
  provider_reference: z.string().optional(),
  status: z.string().optional(),
});

async function tryReferences(
  candidates: (string | undefined)[],
  confirmFn: (reference: string, req: Request) => Promise<{ ok: boolean }>,
  req: Request
): Promise<boolean> {
  for (const ref of candidates) {
    if (!ref) continue;
    if ((await confirmFn(ref, req)).ok) return true;
  }
  return false;
}

/**
 * Async confirmation path for Mobile Money transactions — the primary path
 * for real (non-sandbox) traffic. Live testing showed RohoPay's sandbox
 * key returns the final status synchronously in the collect/disburse
 * response, but a real transaction against production stays "pending"
 * synchronously (the USSD/PIN prompt takes time) and only this webhook
 * carries the final outcome. Both this webhook AND the synchronous-status
 * path in the initiating routes call the same lib/payment-confirmation.ts
 * functions, which only ever act on a still-Pending record — whichever
 * arrives first "wins", the other is a harmless no-op.
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

  const parsed = webhookSchema.safeParse(JSON.parse(rawBody || "{}"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });

  const { event, internal_reference, reference, id, provider_reference } = parsed.data;
  const candidates = [internal_reference, reference, provider_reference, id];
  const successful = event.endsWith(".successful");

  // A "withdraw." event is a payout FROM the SACCO's RohoPay wallet — either
  // a loan disbursement or a member's savings withdrawal. Try both.
  if (event.startsWith("withdraw.")) {
    if (await tryReferences(candidates, successful ? confirmDisbursement : failDisbursement, req)) {
      return NextResponse.json({ acknowledged: true });
    }
    if (await tryReferences(candidates, successful ? confirmSavingsWithdrawal : failSavingsWithdrawal, req)) {
      return NextResponse.json({ acknowledged: true });
    }
    // A valid, correctly-signed webhook from RohoPay that matches nothing in
    // our database is either a reference-matching bug on our side or a
    // transaction we have no record of — worth a human looking at either
    // way, not just a 404 nobody sees.
    await sendCriticalAlert("RohoPay webhook: no matching payout", { event, candidates });
    return NextResponse.json({ error: "No matching payout" }, { status: 404 });
  }

  // A "deposit." event is either a loan repayment collection or a savings
  // deposit — try savings first, then repayment, across all candidate
  // reference fields.
  if (await tryReferences(candidates, successful ? confirmSavingsDeposit : failSavingsDeposit, req)) {
    return NextResponse.json({ acknowledged: true });
  }
  if (await tryReferences(candidates, successful ? confirmRepayment : failRepayment, req)) {
    return NextResponse.json({ acknowledged: true });
  }
  await sendCriticalAlert("RohoPay webhook: no matching transaction", { event, candidates });
  return NextResponse.json({ error: "No matching transaction" }, { status: 404 });
}
