import { requireRole } from "@/lib/auth-guard";
import { isMockMode } from "@/lib/dgateway";
import { webhookSchema, dispatchDGatewayWebhookEvent } from "@/lib/dgateway-webhook-handler";
import { NextResponse } from "next/server";

/**
 * Staging-only stand-in for a real RohoPay webhook delivery. disburse()/
 * collectPayment() in mock mode always return "pending" (see lib/dgateway.ts)
 * so the async confirmation path — the part that's genuinely hard to
 * exercise safely, since it's what creates the Loan/confirms the
 * repayment — still has to be driven by something. This is that something:
 * pass the transactionRef a mock disburse/collect call returned plus the
 * outcome to simulate, and it runs through the exact same
 * dispatchDGatewayWebhookEvent() a real signed RohoPay webhook would.
 *
 * Inert outside mock mode (403) so this can never be reachable in
 * production even if someone forgets to remove it before deploying —
 * gated on DGATEWAY_MODE=mock rather than NODE_ENV, since Vercel Preview
 * deployments still run with NODE_ENV=production.
 */
export async function POST(req: Request) {
  if (!isMockMode()) {
    return NextResponse.json({ error: "Only available when DGATEWAY_MODE=mock" }, { status: 403 });
  }

  const { error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const body = await req.json();
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  return dispatchDGatewayWebhookEvent(parsed.data, req);
}
