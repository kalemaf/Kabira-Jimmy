import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { computeLoanDisplayStatus } from "@/lib/loan-status";
import { generateAmortizationSchedule, computeOutstandingBreakdown } from "@/lib/loan-calculator";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const { id } = await params;
  const loan = await db.loan.findUnique({
    where: { id },
    include: {
      branch: { select: { name: true } },
      member: { select: { firstName: true, lastName: true, memberNumber: true } },
      loanApplication: { include: { loanProduct: true } },
      repayments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  // The real authorization boundary — a member can only ever view their own loan.
  if (loan.memberId !== memberId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const confirmedRepayments = loan.repayments.filter((r) => r.status === "Confirmed");
  const totalPrincipalRepaid = confirmedRepayments.reduce((s, r) => s + r.principalPortion, 0);
  const displayStatus = computeLoanDisplayStatus(loan, totalPrincipalRepaid);

  const schedule = generateAmortizationSchedule({
    principal: loan.principal,
    monthlyRatePercent: loan.interestRate,
    periodMonths: loan.repaymentPeriodMonths,
    method: loan.interestMethod,
    startDate: loan.disbursedAt,
  });
  const outstanding = computeOutstandingBreakdown(schedule, confirmedRepayments, loan.loanApplication.loanProduct.penaltyRate);

  return NextResponse.json({
    id: loan.id,
    principal: loan.principal,
    interestRate: loan.interestRate,
    interestMethod: loan.interestMethod,
    repaymentPeriodMonths: loan.repaymentPeriodMonths,
    disbursedAt: loan.disbursedAt,
    branchName: loan.branch.name,
    memberName: `${loan.member.firstName} ${loan.member.lastName}`,
    memberNumber: loan.member.memberNumber,
    productName: loan.loanApplication.loanProduct.name,
    displayStatus,
    schedule,
    outstanding,
    repayments: loan.repayments,
  });
}
