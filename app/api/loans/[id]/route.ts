import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { computeLoanDisplayStatus } from "@/lib/loan-status";
import { generateAmortizationSchedule } from "@/lib/loan-calculator";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const cacheKey = `tag:${tags.loans}:detail:${id}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const loan = await db.loan.findUnique({
        where: { id },
        include: {
          member: true,
          branch: { select: { id: true, name: true, code: true } },
          disbursedBy: { select: { id: true, name: true } },
          loanApplication: {
            include: {
              loanProduct: true,
              preparedBy: { select: { id: true, name: true } },
              submittedByMemberUser: { select: { name: true } },
              approvalSteps: {
                include: { user: { select: { name: true, role: true } } },
                orderBy: { createdAt: "asc" },
              },
            },
          },
          repayments: {
            orderBy: { paidAt: "desc" },
            include: { collector: { select: { name: true } }, memberUser: { select: { name: true } } },
          },
          guarantors: {
            include: { member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } },
          },
          collateral: true,
          recoveryCase: true,
        },
      });

      if (!loan) return null;

      const confirmedRepayments = loan.repayments.filter((r) => r.status === "Confirmed");
      const totalPrincipalRepaid = confirmedRepayments.reduce((sum, r) => sum + r.principalPortion, 0);
      const displayStatus = computeLoanDisplayStatus(loan, totalPrincipalRepaid);

      const schedule = generateAmortizationSchedule({
        principal: loan.principal,
        monthlyRatePercent: loan.interestRate,
        periodMonths: loan.repaymentPeriodMonths,
        method: loan.interestMethod,
        startDate: loan.disbursedAt,
      });

      return { ...loan, displayStatus, schedule };
    },
    20
  );

  if (!result) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  return NextResponse.json(result);
}
