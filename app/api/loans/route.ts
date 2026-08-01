import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { computeLoanDisplayStatus } from "@/lib/loan-status";
import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const search = searchParams.get("search")?.trim() ?? "";
  const branchId = searchParams.get("branchId")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const cacheKey = `tag:${tags.loans}:${page}:${limit}:${search}:${branchId}:${status}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where: Prisma.LoanWhereInput = {
        ...(branchId ? { branchId } : {}),
        ...(status ? { status: status as Prisma.LoanWhereInput["status"] } : {}),
        ...(search
          ? {
              member: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" as const } },
                  { lastName: { contains: search, mode: "insensitive" as const } },
                  { memberNumber: { contains: search, mode: "insensitive" as const } },
                ],
              },
            }
          : {}),
      };

      const [loans, total] = await Promise.all([
        db.loan.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
            branch: { select: { id: true, name: true } },
            repayments: { where: { status: "Confirmed" }, select: { principalPortion: true } },
          },
        }),
        db.loan.count({ where }),
      ]);

      const data = loans.map((loan) => {
        const totalPrincipalRepaid = loan.repayments.reduce((sum, r) => sum + r.principalPortion, 0);
        const displayStatus = computeLoanDisplayStatus(loan, totalPrincipalRepaid);
        const { repayments, ...loanFields } = loan;
        void repayments;
        return { ...loanFields, displayStatus };
      });

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    20
  );

  return NextResponse.json(result);
}
