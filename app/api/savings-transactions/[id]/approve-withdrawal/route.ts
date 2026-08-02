import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { disburse, isDGatewayConfigured } from "@/lib/dgateway";
import { confirmSavingsWithdrawal } from "@/lib/payment-confirmation";
import { writeAuditLog } from "@/lib/audit";
import { invalidateTag, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum(["Approve", "Reject"]),
  comments: z.string().max(500).optional(),
});

/**
 * Staff approval gate for a self-service Withdrawal that landed above the
 * configured large-withdrawal threshold (status=PendingApproval — no
 * RohoPay payout has been sent yet). Approving here is what actually
 * triggers the real payout; rejecting just fails it with no money movement
 * at all, same "never optimistically complete" discipline as everywhere
 * else money-moving in this app.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "Cashier"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const transaction = await db.savingsTransaction.findUnique({
    where: { id },
    include: { savingsAccount: { include: { member: { select: { firstName: true, lastName: true, phone: true, memberNumber: true } } } } },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (transaction.status !== "PendingApproval" || transaction.type !== "Withdrawal") {
    return NextResponse.json({ error: "This transaction is not awaiting withdrawal approval" }, { status: 400 });
  }

  const { action, comments } = parsed.data;

  if (action === "Reject") {
    await db.savingsTransaction.update({
      where: { id },
      data: { status: "Failed", approvedByUserId: session.user.id, approvedAt: new Date() },
    });
    await writeAuditLog({
      userId: session.user.id,
      action: "savings_transaction.withdrawal_rejected",
      entityType: "SavingsTransaction",
      entityId: id,
      newValue: { comments },
      request: req,
    });
    await invalidateTag(tags.savings);
    return NextResponse.json({ status: "rejected" });
  }

  if (!isDGatewayConfigured()) {
    return NextResponse.json({ error: "Mobile Money is not configured — cannot send this payout" }, { status: 503 });
  }

  const netPayout = transaction.amount - transaction.penaltyAmount;
  const reference = `NGS-SWDR-${transaction.savingsAccountId}-${Date.now()}`;

  try {
    const result = await disburse({
      phone: transaction.savingsAccount.member.phone,
      amountUgx: netPayout,
      reference,
      narration: `Nexcgen savings withdrawal (approved) — ${transaction.savingsAccount.member.memberNumber}`,
    });

    await db.savingsTransaction.update({
      where: { id },
      data: {
        status: "Pending",
        transactionId: result.transactionRef,
        approvedByUserId: session.user.id,
        approvedAt: new Date(),
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "savings_transaction.withdrawal_approved",
      entityType: "SavingsTransaction",
      entityId: id,
      newValue: { comments, transactionRef: result.transactionRef },
      request: req,
    });

    await invalidateTag(tags.savings);

    if (result.status === "successful") {
      const confirmResult = await confirmSavingsWithdrawal(result.transactionRef, req);
      if (confirmResult.ok) return NextResponse.json({ status: "confirmed" });
    }

    return NextResponse.json({ status: "pending", transactionRef: result.transactionRef });
  } catch (e) {
    await writeAuditLog({
      userId: session.user.id,
      action: "savings_transaction.withdrawal_approval_failed",
      entityType: "SavingsTransaction",
      entityId: id,
      newValue: { error: e instanceof Error ? e.message : "Unknown error" },
      request: req,
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mobile Money withdrawal failed" },
      { status: 502 }
    );
  }
}
