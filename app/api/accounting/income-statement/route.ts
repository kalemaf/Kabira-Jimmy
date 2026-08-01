import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireRole(["SuperAdmin", "AccountsOfficer", "Auditor"]);
  if (error) return error;

  const result = await getCachedOrFetch(
    `tag:${tags.ledger}:income-statement`,
    async () => {
      const [revenueAccounts, expenseAccounts] = await Promise.all([
        db.chartOfAccount.findMany({ where: { type: "Revenue" }, orderBy: { code: "asc" } }),
        db.chartOfAccount.findMany({ where: { type: "Expense" }, orderBy: { code: "asc" } }),
      ]);

      const totals = await db.ledgerEntry.groupBy({
        by: ["accountCode"],
        _sum: { debit: true, credit: true },
      });
      const totalsByCode = new Map(totals.map((t) => [t.accountCode, t._sum]));

      // Revenue has a normal CREDIT balance; Expense has a normal DEBIT balance.
      const revenue = revenueAccounts.map((a) => {
        const sums = totalsByCode.get(a.code);
        return { accountCode: a.code, accountName: a.name, amount: (sums?.credit ?? 0) - (sums?.debit ?? 0) };
      });
      const expenses = expenseAccounts.map((a) => {
        const sums = totalsByCode.get(a.code);
        return { accountCode: a.code, accountName: a.name, amount: (sums?.debit ?? 0) - (sums?.credit ?? 0) };
      });

      const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
      const totalExpenses = expenses.reduce((sum, r) => sum + r.amount, 0);

      return { revenue, expenses, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses };
    },
    60
  );

  return NextResponse.json(result);
}
