import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { postLedgerEntries, buildSavingsLedgerLines, ACCOUNTS } from "@/lib/ledger";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const confirmActionSchema = z.object({
  action: z.enum(["Confirm", "Reject"]),
  comments: z.string().max(500).optional(),
});

/**
 * Staff confirmation for a Pending deposit — covers two maker-checker
 * cases with the same second-approver discipline:
 *  - Bank Transfer: the member declared a reference number; a staff
 *    member checks the branch's bank statement.
 *  - Cash: a teller recorded cash physically handed over; a Manager/
 *    SuperAdmin independently confirms it actually reached the till,
 *    so the teller who took the cash can't unilaterally credit any
 *    account for any amount with no second check.
 * Mobile Money deposits are deliberately NOT confirmable through this
 * endpoint — only the RohoPay webhook or the reconcile endpoint (which
 * itself only trusts what RohoPay reports) may confirm those, so a staff
 * member can never fake a "payment successful" for a mobile money charge
 * that didn't happen.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = confirmActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const transaction = await db.savingsTransaction.findUnique({
    where: { id },
    include: { savingsAccount: { select: { accountNumber: true } } },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (transaction.status !== "Pending") {
    return NextResponse.json({ error: `This transaction is already ${transaction.status.toLowerCase()}` }, { status: 400 });
  }
  if (transaction.method !== "BankTransfer" && transaction.method !== "Cash") {
    return NextResponse.json(
      { error: "Only Bank Transfer or Cash deposits can be manually confirmed — Mobile Money is confirmed automatically once RohoPay verifies the charge." },
      { status: 400 }
    );
  }
  if (transaction.method === "Cash" && transaction.staffId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot confirm a cash deposit you recorded yourself — a different Manager or SuperAdmin must confirm it." },
      { status: 403 }
    );
  }

  const { action, comments } = parsed.data;

  if (action === "Reject") {
    await db.savingsTransaction.update({
      where: { id },
      data: { status: "Failed", confirmedByUserId: session.user.id },
    });
    await writeAuditLog({
      userId: session.user.id,
      action: "savings_transaction.member_deposit_rejected",
      entityType: "SavingsTransaction",
      entityId: id,
      newValue: { comments },
      request: req,
    });
    await invalidateTag(tags.savings);
    return NextResponse.json({ status: "rejected" });
  }

  await db.$transaction([
    db.savingsTransaction.update({
      where: { id },
      data: { status: "Confirmed", confirmedByUserId: session.user.id },
    }),
    db.savingsAccount.update({
      where: { id: transaction.savingsAccountId },
      data: { balance: { increment: transaction.amount } },
    }),
  ]);

  await postLedgerEntries(
    buildSavingsLedgerLines(
      {
        id: transaction.id,
        referenceType: "SavingsTransaction",
        description: `Deposit confirmed (${transaction.method === "Cash" ? "Cash" : "Bank Transfer"}) — ${transaction.savingsAccount.accountNumber}`,
        type: "Deposit",
        amount: transaction.amount,
        branchId: transaction.branchId,
      },
      transaction.method === "Cash" ? ACCOUNTS.CASH : ACCOUNTS.BANK
    )
  );

  await writeAuditLog({
    userId: session.user.id,
    action: "savings_transaction.member_deposit_confirmed",
    entityType: "SavingsTransaction",
    entityId: id,
    newValue: { comments, amount: transaction.amount },
    request: req,
  });

  await invalidateTag(tags.savings);
  return NextResponse.json({ status: "confirmed" });
}
