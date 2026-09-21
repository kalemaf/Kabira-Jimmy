import "server-only";
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

// CONFIRMED payload shape (flat, not nested under `data`) — verified
// against RohoPay's own dashboard docs (docs-page scrape AND a dashboard
// code sample both use `internal_reference`; one other code sample used a
// plain `reference` instead). All candidate field names are tried against
// pending records, in order, so this is correct regardless of which one a
// real payload actually uses — the order below is just which is tried
// first.
export const webhookSchema = z.object({
  event: z.enum(["deposit.successful", "deposit.failed", "withdraw.successful", "withdraw.failed"]),
  internal_reference: z.string().optional(),
  reference: z.string().optional(),
  id: z.string().optional(),
  provider_reference: z.string().optional(),
  status: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof webhookSchema>;

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
 * The actual withdraw./deposit. event routing, shared by the real RohoPay
 * webhook (app/api/dgateway/webhook/route.ts, after signature verification)
 * and the staging-only simulate endpoint
 * (app/api/dgateway/webhook/simulate/route.ts, after a mock-mode + auth
 * check) — one dispatch implementation, two different ways of deciding
 * whether to trust the caller.
 */
export async function dispatchDGatewayWebhookEvent(payload: WebhookPayload, req: Request) {
  const { event, internal_reference, reference, id, provider_reference } = payload;
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
