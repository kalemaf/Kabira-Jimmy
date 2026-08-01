import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireRole(["SuperAdmin", "AccountsOfficer", "Auditor"]);
  if (error) return error;

  const accounts = await getCachedOrFetch(
    `tag:${tags.ledger}:chart-of-accounts`,
    () => db.chartOfAccount.findMany({ orderBy: { code: "asc" } }),
    300
  );

  return NextResponse.json({ data: accounts });
}
