import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  // Matches nav-config's Accounting section — financial statements are
  // restricted to roles with a legitimate accounting-oversight need, not
  // every authenticated staff member.
  const { error } = await requireRole(["SuperAdmin", "AccountsOfficer", "Auditor"]);
  if (error) return error;

  const result = await getCachedOrFetch(
    `tag:${tags.ledger}:balance-sheet`,
    async () => {
      const [assetAccounts, liabilityAccounts, equityAccounts, revenueAccounts, expenseAccounts] =
        await Promise.all([
          db.chartOfAccount.findMany({ where: { type: "Asset" }, orderBy: { code: "asc" } }),
          db.chartOfAccount.findMany({ where: { type: "Liability" }, orderBy: { code: "asc" } }),
          db.chartOfAccount.findMany({ where: { type: "Equity" }, orderBy: { code: "asc" } }),
          db.chartOfAccount.findMany({ where: { type: "Revenue" } }),
          db.chartOfAccount.findMany({ where: { type: "Expense" } }),
        ]);

      const totals = await db.ledgerEntry.groupBy({
        by: ["accountCode"],
        _sum: { debit: true, credit: true },
      });
      const totalsByCode = new Map(totals.map((t) => [t.accountCode, t._sum]));
      const balanceFor = (code: string, normalSide: "debit" | "credit") => {
        const sums = totalsByCode.get(code);
        const debit = sums?.debit ?? 0;
        const credit = sums?.credit ?? 0;
        return normalSide === "debit" ? debit - credit : credit - debit;
      };

      const assets = assetAccounts.map((a) => ({ accountCode: a.code, accountName: a.name, amount: balanceFor(a.code, "debit") }));
      const liabilities = liabilityAccounts.map((a) => ({ accountCode: a.code, accountName: a.name, amount: balanceFor(a.code, "credit") }));
      const equity = equityAccounts.map((a) => ({ accountCode: a.code, accountName: a.name, amount: balanceFor(a.code, "credit") }));

      // Books aren't formally closed each period — current-period net income
      // is rolled into Equity live so Assets = Liabilities + Equity holds.
      const totalRevenue = revenueAccounts.reduce((sum, a) => sum + balanceFor(a.code, "credit"), 0);
      const totalExpenses = expenseAccounts.reduce((sum, a) => sum + balanceFor(a.code, "debit"), 0);
      const currentPeriodEarnings = totalRevenue - totalExpenses;

      const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
      const totalLiabilities = liabilities.reduce((sum, a) => sum + a.amount, 0);
      const totalEquity = equity.reduce((sum, a) => sum + a.amount, 0) + currentPeriodEarnings;

      return {
        assets,
        liabilities,
        equity: [...equity, { accountCode: "3900", accountName: "Current Period Earnings", amount: currentPeriodEarnings }],
        totalAssets,
        totalLiabilities,
        totalEquity,
        balanced: totalAssets === totalLiabilities + totalEquity,
      };
    },
    60
  );

  return NextResponse.json(result);
}
