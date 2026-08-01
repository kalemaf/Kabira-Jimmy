import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getTransactionStatus } from "@/lib/dgateway";
import { confirmRepayment, failRepayment } from "@/lib/payment-confirmation";
import { NextResponse } from "next/server";

/**
 * Re-checks a stuck Pending Mobile Money repayment directly against
 * RohoPay — same reasoning as app/api/savings-transactions/[id]/reconcile.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["SuperAdmin", "Manager", "Cashier", "LoanOfficer"]);
  if (error) return error;

  const { id } = await params;
  const repayment = await db.repayment.findUnique({ where: { id } });
  if (!repayment) return NextResponse.json({ error: "Repayment not found" }, { status: 404 });

  if (repayment.status !== "Pending") {
    return NextResponse.json({ error: `This repayment is already ${repayment.status.toLowerCase()}` }, { status: 400 });
  }
  if (repayment.method !== "MobileMoney" || !repayment.transactionId) {
    return NextResponse.json({ error: "Only Mobile Money repayments can be reconciled here" }, { status: 400 });
  }

  let gatewayStatus;
  try {
    gatewayStatus = await getTransactionStatus(repayment.transactionId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not reach RohoPay to check this repayment's status" },
      { status: 502 }
    );
  }

  if (gatewayStatus.status === "successful") {
    const result = await confirmRepayment(repayment.transactionId, req);
    if (!result.ok) return NextResponse.json({ error: "Repayment changed state — refresh and retry" }, { status: 409 });
    return NextResponse.json({ status: "confirmed" });
  }

  if (gatewayStatus.status === "failed") {
    const result = await failRepayment(repayment.transactionId, req);
    if (!result.ok) return NextResponse.json({ error: "Repayment changed state — refresh and retry" }, { status: 409 });
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "pending", message: "RohoPay still reports this repayment as pending." });
}
