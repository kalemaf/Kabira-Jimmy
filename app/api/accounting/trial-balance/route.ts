import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireRole(["SuperAdmin", "AccountsOfficer", "Auditor"]);
  if (error) return error;

  const result = await getCachedOrFetch(
    `tag:${tags.ledger}:trial-balance`,
    async () => {
      const accounts = await db.chartOfAccount.findMany({ orderBy: { code: "asc" } });
      const totals = await db.ledgerEntry.groupBy({
        by: ["accountCode"],
        _sum: { debit: true, credit: true },
      });
      const totalsByCode = new Map(totals.map((t) => [t.accountCode, t._sum]));

      const rows = accounts.map((account) => {
        const sums = totalsByCode.get(account.code);
        const totalDebit = sums?.debit ?? 0;
        const totalCredit = sums?.credit ?? 0;
        return {
          accountCode: account.code,
          accountName: account.name,
          type: account.type,
          totalDebit,
          totalCredit,
        };
      });

      const grandTotalDebit = rows.reduce((sum, r) => sum + r.totalDebit, 0);
      const grandTotalCredit = rows.reduce((sum, r) => sum + r.totalCredit, 0);

      return {
        rows,
        grandTotalDebit,
        grandTotalCredit,
        balanced: grandTotalDebit === grandTotalCredit,
      };
    },
    60
  );

  return NextResponse.json(result);
}
