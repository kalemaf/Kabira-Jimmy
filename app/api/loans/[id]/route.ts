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

      // The phone a Mobile Money disbursement was actually sent to is never
      // stored on Loan/LoanApplication itself — it's only ever passed through
      // to the gateway — but it IS captured durably in the audit log entry
      // written when the payout was initiated (see disburse/route.ts). Match
      // on the winning transaction reference rather than just taking the
      // latest entry, since a loan can carry several failed attempts (with
      // possibly different phone numbers) before the one that succeeded.
      let disbursementPhone: string | null = null;
      if (loan.disbursementMethod === "MobileMoney") {
        const attempts = await db.auditLog.findMany({
          where: {
            entityType: "LoanApplication",
            entityId: loan.loanApplicationId,
            action: "loan_application.disbursement_initiated",
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        const targetRef = loan.loanApplication.disbursementTransactionRef;
        const match =
          attempts.find((a) => (a.newValue as { reference?: string } | null)?.reference === targetRef) ??
          attempts[0] ??
          null;
        disbursementPhone = (match?.newValue as { phone?: string } | null)?.phone ?? null;
      }

      return { ...loan, displayStatus, schedule, disbursementPhone };
    },
    20
  );

  if (!result) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  return NextResponse.json(result);
}
