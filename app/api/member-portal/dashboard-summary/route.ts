import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { generateAmortizationSchedule, computeOutstandingBreakdown } from "@/lib/loan-calculator";
import { computeLoanDisplayStatus } from "@/lib/loan-status";
import { getEligibilityPolicy } from "@/lib/eligibility-policy";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

const TREND_MONTHS = 6;

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const member = await db.member.findUnique({
    where: { id: memberId },
    include: {
      branch: { select: { name: true } },
      savingsAccounts: {
        include: { transactions: { orderBy: { createdAt: "asc" } } },
      },
      loans: {
        orderBy: { disbursedAt: "desc" },
        include: {
          loanApplication: { include: { loanProduct: { select: { name: true, penaltyRate: true } } } },
          repayments: { where: { status: "Confirmed" }, select: { principalPortion: true, interestPortion: true, penaltyPortion: true, paidAt: true } },
        },
      },
    },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const totalSavingsBalance = member.savingsAccounts.reduce((sum, a) => sum + a.balance, 0);
  const sharesBalance = member.savingsAccounts.filter((a) => a.type === "Shares").reduce((sum, a) => sum + a.balance, 0);

  // Pending/Failed deposits haven't actually landed — a member-initiated
  // Mobile Money or Bank Transfer deposit only counts once it's Confirmed
  // (see app/api/member-portal/savings/deposit), so every figure below must
  // exclude anything still awaiting verification.
  const confirmedTransactions = member.savingsAccounts.flatMap((a) => a.transactions).filter((t) => t.status === "Confirmed");
  const now = new Date();
  const thisMonthKey = monthKey(now);
  const totalDepositsThisMonth = confirmedTransactions
    .filter((t) => t.type === "Deposit" && monthKey(t.createdAt) === thisMonthKey)
    .reduce((sum, t) => sum + t.amount, 0);
  const interestEarned = confirmedTransactions
    .filter((t) => t.type === "Interest")
    .reduce((sum, t) => sum + t.amount, 0);

  // Monthly deposits + month-end balance trend for the last TREND_MONTHS months.
  const monthBoundaries: { key: string; label: string; end: Date }[] = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59));
    monthBoundaries.push({ key: monthKey(d), label: d.toLocaleDateString("en-UG", { month: "short", timeZone: "UTC" }), end: d });
  }

  const monthlyDeposits = monthBoundaries.map(({ key, label }) => ({
    month: label,
    deposits: confirmedTransactions.filter((t) => t.type === "Deposit" && monthKey(t.createdAt) === key).reduce((s, t) => s + t.amount, 0),
  }));

  const savingsGrowth = monthBoundaries.map(({ label, end }) => {
    const balance = member.savingsAccounts.reduce((sum, account) => {
      const lastTxnByThen = [...account.transactions]
        .filter((t) => t.status === "Confirmed")
        .reverse()
        .find((t) => t.createdAt <= end);
      return sum + (lastTxnByThen ? lastTxnByThen.balanceAfter : 0);
    }, 0);
    return { month: label, balance };
  });

  const activeLoan = member.loans.find((l) => l.status === "Active" || l.status === "Overdue") ?? null;

  let loanSummary = null;
  if (activeLoan) {
    const schedule = generateAmortizationSchedule({
      principal: activeLoan.principal,
      monthlyRatePercent: activeLoan.interestRate,
      periodMonths: activeLoan.repaymentPeriodMonths,
      method: activeLoan.interestMethod,
      startDate: activeLoan.disbursedAt,
    });
    const totalPrincipalRepaid = activeLoan.repayments.reduce((s, r) => s + r.principalPortion, 0);
    const displayStatus = computeLoanDisplayStatus(activeLoan, totalPrincipalRepaid);
    const outstanding = computeOutstandingBreakdown(schedule, activeLoan.repayments, activeLoan.loanApplication.loanProduct.penaltyRate);

    let cumulativePrincipal = 0;
    let nextRow = schedule.rows[schedule.rows.length - 1];
    for (const row of schedule.rows) {
      cumulativePrincipal += row.principal;
      if (cumulativePrincipal > totalPrincipalRepaid) {
        nextRow = row;
        break;
      }
    }

    loanSummary = {
      id: activeLoan.id,
      productName: activeLoan.loanApplication.loanProduct.name,
      principal: activeLoan.principal,
      outstandingBalance: displayStatus.outstandingBalance,
      totalPayable: schedule.totalPayable,
      repaidAmount: schedule.totalPayable - (displayStatus.outstandingBalance + outstanding.interestDue + outstanding.penaltyDue),
      progressPercent: Math.min(100, Math.round((totalPrincipalRepaid / activeLoan.principal) * 100)),
      status: displayStatus.label,
      tone: displayStatus.tone,
      nextRepayment: { amount: nextRow.installment, dueDate: nextRow.dueDate },
    };
  }

  const { savingsToLoanRatio } = await getEligibilityPolicy();
  const maxEligibleLoan = Math.round(totalSavingsBalance / savingsToLoanRatio);

  return NextResponse.json({
    member: {
      firstName: member.firstName,
      lastName: member.lastName,
      memberNumber: member.memberNumber,
      status: member.status,
      photoUrl: member.photoUrl,
      branchName: member.branch.name,
      dateJoined: member.dateJoined,
    },
    totalSavingsBalance,
    sharesBalance,
    totalDepositsThisMonth,
    interestEarned,
    maxEligibleLoan,
    savingsToLoanRatio,
    loan: loanSummary,
    monthlyDeposits,
    savingsGrowth,
  });
}
