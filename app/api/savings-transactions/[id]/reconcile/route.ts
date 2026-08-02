import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { getTransactionStatus } from "@/lib/dgateway";
import { confirmSavingsDeposit, failSavingsDeposit } from "@/lib/payment-confirmation";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Re-checks a stuck Pending Mobile Money deposit directly against RohoPay,
 * for the case where neither the synchronous collect response nor the
 * async webhook ever confirmed it (e.g. RohoPay's webhook delivery has been
 * observed taking several minutes — sometimes longer). Unlike the Bank
 * Transfer confirm route, this never lets anyone vouch for the transaction
 * themselves — it only ever acts on what RohoPay itself reports for this
 * reference, which is why it's safe to also let the member who owns the
 * transaction trigger it (not just staff): a member can only ever get back
 * whatever RohoPay's real API says, never fabricate a confirmation.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const transaction = await db.savingsTransaction.findUnique({
    where: { id },
    include: { savingsAccount: { select: { memberId: true } } },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const staffResult = await requireRole(["SuperAdmin", "Manager", "Cashier"]);
  if (staffResult.error) {
    const memberSession = await memberAuth.api.getSession({ headers: await headers() });
    if (!memberSession) return staffResult.error;
    const memberId = await getLinkedMemberId(memberSession.user.id);
    if (!memberId || memberId !== transaction.savingsAccount.memberId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

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
