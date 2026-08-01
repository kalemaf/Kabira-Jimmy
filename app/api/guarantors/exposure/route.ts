import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { GUARANTOR_EXPOSURE_LIMIT_UGX, SAVINGS_TO_LOAN_RATIO } from "@/lib/loan-eligibility";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const cacheKey = `tag:${tags.guarantors}:exposure:${search}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const guarantors = await db.guarantor.findMany({
        include: {
          member: { select: { id: true, firstName: true, lastName: true, memberNumber: true, status: true } },
          loanApplication: {
            select: {
              status: true,
              member: { select: { firstName: true, lastName: true, memberNumber: true } },
            },
          },
          loan: {
            select: {
              status: true,
              member: { select: { firstName: true, lastName: true, memberNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      type Guarantee = {
        borrowerName: string;
        borrowerMemberNumber: string;
        guaranteeAmount: number;
        status: string;
        loanStatus: string | null;
      };

      const grouped = new Map<
        string,
        {
          member: { id: string; firstName: string; lastName: string; memberNumber: string; status: string };
          totalExposure: number;
          guaranteeCount: number;
          blocked: boolean;
          guarantees: Guarantee[];
        }
      >();

      for (const g of guarantors) {
        if (search) {
          const haystack = `${g.member.firstName} ${g.member.lastName} ${g.member.memberNumber}`.toLowerCase();
          if (!haystack.includes(search.toLowerCase())) continue;
        }
        const entry = grouped.get(g.memberId) ?? {
          member: g.member,
          totalExposure: 0,
          guaranteeCount: 0,
          blocked: false,
          guarantees: [],
        };
        entry.totalExposure += g.guaranteeAmount;
        entry.guaranteeCount += 1;
        if (g.status === "Blocked") entry.blocked = true;

        // Loan (disbursed) is the more current source once it exists; the
        // application relation is what's populated before disbursement.
        const borrower = g.loan?.member ?? g.loanApplication?.member ?? null;
        entry.guarantees.push({
          borrowerName: borrower ? `${borrower.firstName} ${borrower.lastName}` : "Unknown",
          borrowerMemberNumber: borrower?.memberNumber ?? "—",
          guaranteeAmount: g.guaranteeAmount,
          status: g.status,
          loanStatus: g.loan?.status ?? g.loanApplication?.status ?? null,
        });

        grouped.set(g.memberId, entry);
      }

      const memberIds = Array.from(grouped.keys());
      const savingsAgg =
        memberIds.length > 0
          ? await db.savingsAccount.groupBy({
              by: ["memberId"],
              where: { memberId: { in: memberIds } },
              _sum: { balance: true },
            })
          : [];
      const savingsByMember = new Map(savingsAgg.map((s) => [s.memberId, s._sum.balance ?? 0]));

      const data = Array.from(grouped.values()).map((entry) => {
        const savingsBalance = savingsByMember.get(entry.member.id) ?? 0;
        const requiredSavings = Math.round(entry.totalExposure * SAVINGS_TO_LOAN_RATIO);
        const savingsStatus: "None" | "Low" | "Adequate" =
          savingsBalance === 0 ? "None" : savingsBalance < requiredSavings ? "Low" : "Adequate";

        const remainingCapacity = Math.max(GUARANTOR_EXPOSURE_LIMIT_UGX - entry.totalExposure, 0);
        const canGuaranteeMore = !entry.blocked && entry.member.status === "Active" && remainingCapacity > 0;
        const ineligibleReasons: string[] = [];
        if (entry.blocked) ineligibleReasons.push("Blocked — guarantee limit exceeded");
        if (entry.member.status !== "Active") ineligibleReasons.push(`Member status is ${entry.member.status}, not Active`);
        if (remainingCapacity <= 0 && !entry.blocked) ineligibleReasons.push("No remaining guarantee capacity");

        return {
          ...entry,
          savingsBalance,
          savingsStatus,
          remainingCapacity,
          canGuaranteeMore,
          ineligibleReasons,
        };
      });

      return {
        data: data.sort((a, b) => b.totalExposure - a.totalExposure),
        limitUgx: GUARANTOR_EXPOSURE_LIMIT_UGX,
        savingsToLoanRatio: SAVINGS_TO_LOAN_RATIO,
      };
    },
    30
  );

  return NextResponse.json(result);
}
