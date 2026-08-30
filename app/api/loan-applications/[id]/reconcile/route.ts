import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getTransactionStatus } from "@/lib/dgateway";
import { confirmDisbursement, failDisbursement } from "@/lib/payment-confirmation";
import { NextResponse } from "next/server";

/**
 * Re-checks a stuck Pending Mobile Money loan disbursement directly against
 * RohoPay, for the case where neither the synchronous payout response nor
 * the async webhook ever confirmed it — the same safety net already built
 * for savings deposits (app/api/savings-transactions/[id]/reconcile), now
 * mirrored for disbursements after live-testing showed the payout path can
 * take the same several-minutes-or-more webhook delivery as collections.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["SuperAdmin", "Manager", "Cashier", "LoanOfficer"]);
  if (error) return error;

  const { id } = await params;
  const application = await db.loanApplication.findUnique({ where: { id } });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  // The async webhook can confirm the payout (see app/api/dgateway/webhook)
  // in the gap between this page loading and someone clicking "Check with
  // RohoPay" — that's not a client error, it's the best-case outcome, so
  // report it the same way a successful reconcile would rather than a 400.
  if (application.status === "Disbursed") {
    return NextResponse.json({ status: "disbursed" });
  }

  if (application.status !== "PendingDisbursement" || !application.disbursementTransactionRef) {
    return NextResponse.json(
      { error: "This application has no pending Mobile Money disbursement to reconcile" },
      { status: 400 }
    );
  }

  let gatewayStatus;
  try {
    gatewayStatus = await getTransactionStatus(application.disbursementTransactionRef);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not reach RohoPay to check this transaction's status" },
      { status: 502 }
    );
  }

  if (gatewayStatus.status === "successful") {
    const result = await confirmDisbursement(application.disbursementTransactionRef, req);
    if (!result.ok) return NextResponse.json({ error: "Transaction changed state — refresh and retry" }, { status: 409 });
    return NextResponse.json({ status: "disbursed" });
  }

  if (gatewayStatus.status === "failed") {
    const result = await failDisbursement(application.disbursementTransactionRef, req);
    if (!result.ok) return NextResponse.json({ error: "Transaction changed state — refresh and retry" }, { status: 409 });
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "pending", message: "RohoPay still reports this payout as pending." });
}
