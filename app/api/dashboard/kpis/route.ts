import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { generateAmortizationSchedule } from "@/lib/loan-calculator";
import { ACCOUNTS } from "@/lib/account-codes";
import { NextResponse } from "next/server";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const result = await getCachedOrFetch(
    `tag:${tags.ledger}:dashboard-kpis`,
    async () => {
      const today = startOfDay();
      const tomorrow = new Date(today.getTime() + 86_400_000);
      const monthStart = startOfMonth();

      const [
        totalMembers,
        totalSavingsAgg,
        loansByStatus,
        todaysCollections,
        todaysDeposits,
        todaysWithdrawals,
        interestEarned,
        penaltyEarned,
        expenseTotal,
        cashCreditThisMonth,
        cashDebitThisMonth,
        branches,
        recentRepayments,
        recentTransactions,
        openLoans,
        recoveredAgg,
        totalRecoveryTargetAgg,
      ] = await Promise.all([
        db.member.count(),
        db.savingsAccount.aggregate({ _sum: { balance: true } }),
        db.loan.groupBy({ by: ["status"], _count: true, _sum: { principal: true } }),
        db.repayment.aggregate({
          where: { status: "Confirmed", paidAt: { gte: today, lt: tomorrow } },
          _sum: { amountPaid: true },
        }),
        db.savingsTransaction.aggregate({
          where: { type: "Deposit", status: "Confirmed", createdAt: { gte: today, lt: tomorrow } },
          _sum: { amount: true },
        }),
        db.savingsTransaction.aggregate({
          where: { type: "Withdrawal", status: "Confirmed", createdAt: { gte: today, lt: tomorrow } },
          _sum: { amount: true },
        }),
        db.ledgerEntry.aggregate({
          where: { accountCode: ACCOUNTS.INTEREST_INCOME, createdAt: { gte: monthStart } },
          _sum: { credit: true },
        }),
        db.ledgerEntry.aggregate({
          where: { accountCode: ACCOUNTS.PENALTY_INCOME, createdAt: { gte: monthStart } },
          _sum: { credit: true },
        }),
        db.ledgerEntry.groupBy({
          by: ["accountCode"],
          where: { account: { type: "Expense" }, createdAt: { gte: monthStart } },
          _sum: { debit: true },
        }),
        db.ledgerEntry.aggregate({
          where: { accountCode: { in: [ACCOUNTS.CASH, ACCOUNTS.BANK] }, createdAt: { gte: monthStart } },
          _sum: { debit: true },
        }),
        db.ledgerEntry.aggregate({
          where: { accountCode: { in: [ACCOUNTS.CASH, ACCOUNTS.BANK] }, createdAt: { gte: monthStart } },
          _sum: { credit: true },
        }),
        db.branch.findMany({
          select: {
            id: true,
            name: true,
            _count: { select: { members: true, loans: true } },
          },
        }),
        db.repayment.findMany({
          where: { status: "Confirmed" },
          orderBy: { paidAt: "desc" },
          take: 8,
          include: { loan: { include: { member: { select: { firstName: true, lastName: true } } } } },
        }),
        db.savingsTransaction.findMany({
          where: { status: "Confirmed" },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            savingsAccount: { include: { member: { select: { firstName: true, lastName: true } } } },
          },
        }),
        // These three used to run as separate sequential awaits after this
        // batch, each paying its own round trip for no reason — none of
        // them depend on anything above or on each other, so one parallel
        // wave replaces what was three serialized ones.
        db.loan.findMany({
          where: { status: { in: ["Active", "Overdue", "Defaulted"] } },
          include: { repayments: { where: { status: "Confirmed" } } },
        }),
        db.recoveryCase.aggregate({ _sum: { recoveredAmount: true } }),
        db.recoveryCase.findMany({ include: { loan: { select: { principal: true } } } }),
      ]);

      const statusCounts: Record<string, { count: number; principal: number }> = {};
      for (const row of loansByStatus) {
        statusCounts[row.status] = { count: row._count, principal: row._sum.principal ?? 0 };
      }
      const totalLoansCount = loansByStatus.reduce((s, r) => s + r._count, 0);
      const totalDisbursedPrincipal = loansByStatus.reduce((s, r) => s + (r._sum.principal ?? 0), 0);

      // Outstanding balance: needs schedule + confirmed repayments per active/overdue/defaulted loan.
      let outstandingTotal = 0;
      let expectedToday = 0;
      for (const loan of openLoans) {
        const repaidPrincipal = loan.repayments.reduce((s, r) => s + r.principalPortion, 0);
        outstandingTotal += Math.max(loan.principal - repaidPrincipal, 0);

        const schedule = generateAmortizationSchedule({
          principal: loan.principal,
          monthlyRatePercent: loan.interestRate,
          periodMonths: loan.repaymentPeriodMonths,
          method: loan.interestMethod,
          startDate: loan.disbursedAt,
        });
        const dueTodayRow = schedule.rows.find((row) => {
          const d = new Date(row.dueDate);
          return d >= today && d < tomorrow;
        });
        if (dueTodayRow) expectedToday += dueTodayRow.installment;
      }

      const atRiskPrincipal = (statusCounts["Overdue"]?.principal ?? 0) + (statusCounts["Defaulted"]?.principal ?? 0);
      const portfolioAtRisk = totalDisbursedPrincipal > 0 ? (atRiskPrincipal / totalDisbursedPrincipal) * 100 : 0;
      const defaultRate = totalLoansCount > 0 ? ((statusCounts["Defaulted"]?.count ?? 0) / totalLoansCount) * 100 : 0;

      const totalRecoveryTarget = totalRecoveryTargetAgg.reduce((s, c) => s + c.loan.principal, 0);
      const recoveryRate = totalRecoveryTarget > 0 ? ((recoveredAgg._sum.recoveredAmount ?? 0) / totalRecoveryTarget) * 100 : 0;

      const totalExpenses = expenseTotal.reduce((s, e) => s + (e._sum.debit ?? 0), 0);
      const totalInterest = interestEarned._sum.credit ?? 0;
      const totalPenalty = penaltyEarned._sum.credit ?? 0;
      const netProfit = totalInterest + totalPenalty - totalExpenses;

      const loanStatusBreakdown = [
        { status: "Active", count: statusCounts["Active"]?.count ?? 0 },
        { status: "Overdue", count: statusCounts["Overdue"]?.count ?? 0 },
        { status: "Defaulted", count: statusCounts["Defaulted"]?.count ?? 0 },
        { status: "PaidOff", count: statusCounts["PaidOff"]?.count ?? 0 },
      ];

      const branchPerformance = branches.map((b) => ({
        branch: b.name,
        members: b._count.members,
        loans: b._count.loans,
      }));

      return {
        totalMembers,
        totalSavings: totalSavingsAgg._sum.balance ?? 0,
        totalLoans: totalLoansCount,
        totalDisbursedPrincipal,
        outstandingLoans: outstandingTotal,
        activeLoans: statusCounts["Active"]?.count ?? 0,
        overdueLoans: statusCounts["Overdue"]?.count ?? 0,
        defaultedLoans: statusCounts["Defaulted"]?.count ?? 0,
        paidOffLoans: statusCounts["PaidOff"]?.count ?? 0,
        todaysCollections: todaysCollections._sum.amountPaid ?? 0,
        todaysDeposits: todaysDeposits._sum.amount ?? 0,
        todaysWithdrawals: todaysWithdrawals._sum.amount ?? 0,
        expectedCollectionsToday: expectedToday,
        interestEarnedMonth: totalInterest,
        penaltyEarnedMonth: totalPenalty,
        operationalExpensesMonth: totalExpenses,
        monthlyNetProfit: netProfit,
        cashFlowMonth: (cashCreditThisMonth._sum.debit ?? 0) - (cashDebitThisMonth._sum.credit ?? 0),
        portfolioAtRisk,
        loanRecoveryRate: recoveryRate,
        defaultRate,
        loanStatusBreakdown,
        branchPerformance,
        recentRepayments: recentRepayments.map((r) => ({
          id: r.id,
          memberName: `${r.loan.member.firstName} ${r.loan.member.lastName}`,
          amount: r.amountPaid,
          paidAt: r.paidAt,
        })),
        recentSavingsTransactions: recentTransactions.map((t) => ({
          id: t.id,
          memberName: `${t.savingsAccount.member.firstName} ${t.savingsAccount.member.lastName}`,
          type: t.type,
          amount: t.amount,
          createdAt: t.createdAt,
        })),
      };
    },
    60
  );

  return NextResponse.json(result);
}
