import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getTransactionStatus } from "@/lib/dgateway";
import { confirmSavingsDeposit, failSavingsDeposit } from "@/lib/payment-confirmation";
import { NextResponse } from "next/server";

/**
 * Re-checks a stuck Pending Mobile Money deposit directly against RohoPay,
 * for the case where neither the synchronous collect response nor the
 * async webhook ever confirmed it (e.g. a webhook that was never delivered
 * because RohoPay's dashboard has no webhook URL configured, or the
 * signature-header guess in app/api/dgateway/webhook/route.ts doesn't match
 * what RohoPay actually sends). Unlike the Bank Transfer confirm route,
 * this never lets a staff member vouch for the transaction themselves — it
 * only ever acts on what RohoPay itself reports for this reference.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["SuperAdmin", "Manager", "Cashier"]);
  if (error) return error;

  const { id } = await params;
  const transaction = await db.savingsTransaction.findUnique({ where: { id } });
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (transaction.status !== "Pending") {
    return NextResponse.json({ error: `This transaction is already ${transaction.status.toLowerCase()}` }, { status: 400 });
  }
  if (transaction.method !== "MobileMoney" || !transaction.transactionId) {
    return NextResponse.json({ error: "Only Mobile Money deposits can be reconciled here" }, { status: 400 });
  }

  let gatewayStatus;
  try {
    gatewayStatus = await getTransactionStatus(transaction.transactionId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not reach RohoPay to check this transaction's status" },
      { status: 502 }
    );
  }

  if (gatewayStatus.status === "successful") {
    const result = await confirmSavingsDeposit(transaction.transactionId, req);
    if (!result.ok) return NextResponse.json({ error: "Transaction changed state — refresh and retry" }, { status: 409 });
    return NextResponse.json({ status: "confirmed" });
  }

  if (gatewayStatus.status === "failed") {
    const result = await failSavingsDeposit(transaction.transactionId, req);
    if (!result.ok) return NextResponse.json({ error: "Transaction changed state — refresh and retry" }, { status: 409 });
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "pending", message: "RohoPay still reports this transaction as pending." });
}
