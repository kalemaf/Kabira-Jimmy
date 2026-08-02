import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Real activity feed (deposits, withdrawals, loan repayments) rather than a
 * separate notifications system — there's no admin-authored announcements
 * model in this app yet, so this only surfaces things that actually
 * happened, not a general messaging inbox.
 */
export async function GET() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const [savingsTxns, repayments] = await Promise.all([
    db.savingsTransaction.findMany({
      where: { savingsAccount: { memberId }, status: "Confirmed" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, amount: true, createdAt: true },
    }),
    db.repayment.findMany({
      where: { loan: { memberId }, status: "Confirmed" },
      orderBy: { paidAt: "desc" },
      take: 10,
      select: { id: true, amountPaid: true, paidAt: true },
    }),
  ]);

  const items = [
    ...savingsTxns.map((t) => ({
      id: `savings-${t.id}`,
      message: `${t.type} of UGX ${t.amount.toLocaleString()} recorded`,
      at: t.createdAt,
    })),
    ...repayments.map((r) => ({
      id: `repayment-${r.id}`,
      message: `Loan repayment of UGX ${r.amountPaid.toLocaleString()} received`,
      at: r.paidAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return NextResponse.json({ data: items });
}
