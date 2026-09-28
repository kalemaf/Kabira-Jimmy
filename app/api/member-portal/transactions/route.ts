import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

type UnifiedTxn = {
  id: string;
  date: string;
  type: "Deposit" | "Withdrawal" | "Fee" | "Interest" | "Loan Repayment" | "Loan Disbursement";
  description: string;
  amount: number;
  balanceAfter: number | null;
  status: string;
};

/**
 * Unified transaction history — savings activity + loan repayments +
 * disbursements, merged and sorted. A member's own dataset is small enough
 * to fetch in full and paginate/filter in memory rather than needing a SQL
 * UNION across two tables with different shapes.
 */
export async function GET(req: Request) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const type = searchParams.get("type")?.trim() ?? "";
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

  const [savingsTxns, repayments, loans] = await Promise.all([
    db.savingsTransaction.findMany({
      where: { savingsAccount: { memberId } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { savingsAccount: { select: { accountNumber: true } } },
    }),
    db.repayment.findMany({
      where: { loan: { memberId } },
      orderBy: { paidAt: "desc" },
      take: 200,
    }),
    db.loan.findMany({
      where: { memberId },
      select: { id: true, principal: true, disbursedAt: true, disbursementMethod: true },
      take: 50,
    }),
  ]);

  const items: UnifiedTxn[] = [
    ...savingsTxns.map((t) => ({
      id: `savings-${t.id}`,
      date: t.createdAt.toISOString(),
      type: t.type as UnifiedTxn["type"],
      description: `${t.type} — ${t.savingsAccount.accountNumber}`,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      status: t.status,
    })),
    ...repayments.map((r) => ({
      id: `repayment-${r.id}`,
      date: r.paidAt.toISOString(),
      type: "Loan Repayment" as const,
      description: `Loan repayment — ${r.receiptNumber} (${r.method})`,
      amount: r.amountPaid,
      balanceAfter: null,
      status: r.status,
    })),
    ...loans.map((l) => ({
      id: `disbursement-${l.id}`,
      date: l.disbursedAt.toISOString(),
      type: "Loan Disbursement" as const,
      description: `Loan disbursed (${l.disbursementMethod})`,
      amount: l.principal,
      balanceAfter: null,
      status: "Confirmed",
    })),
  ]
    .filter((t) => (type ? t.type === type : true))
    .filter((t) => (search ? t.description.toLowerCase().includes(search) : true))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = items.length;
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}
