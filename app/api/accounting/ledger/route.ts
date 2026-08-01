import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function GET(req: Request) {
  const { error } = await requireRole(["SuperAdmin", "AccountsOfficer", "Auditor"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const accountCode = searchParams.get("accountCode")?.trim() ?? "";
  const branchId = searchParams.get("branchId")?.trim() ?? "";
  const cacheKey = `tag:${tags.ledger}:${page}:${limit}:${accountCode}:${branchId}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where: Prisma.LedgerEntryWhereInput = {
        ...(accountCode ? { accountCode } : {}),
        ...(branchId ? { branchId } : {}),
      };

      const [data, total] = await Promise.all([
        db.ledgerEntry.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { account: true, branch: { select: { name: true } } },
        }),
        db.ledgerEntry.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    30
  );

  return NextResponse.json(result);
}
