import "server-only";
import { db } from "@/lib/db";
import { getWithdrawalPolicy } from "@/lib/withdrawal-policy";
import { getEligibilityPolicy } from "@/lib/eligibility-policy";

export type WithdrawalCheckResult =
  | {
      eligible: true;
      requiresApproval: boolean;
      penaltyAmount: number;
      netPayoutAmount: number;
      availableForWithdrawal: number;
    }
  | {
      eligible: false;
      reason: string;
      availableForWithdrawal: number;
    };

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * The withdrawal policy engine — implements, in order:
 *  1. Freeze check (member under investigation).
 *  2. Type-specific rules: Shares never withdrawable self-service; Fixed
 *     locked until maturity (or early-withdrawal penalty if the SACCO
 *     allows it); Daily/Flexible must keep the configured minimum balance.
 *  3. Loan-collateral hold — savings pledged against any Active/Overdue
 *     loan (the same SAVINGS_TO_LOAN_RATIO used at loan approval time)
 *     stay unavailable until that loan is cleared.
 *  4. Race protection — other withdrawals already in flight (Pending or
 *     PendingApproval, i.e. not yet confirmed OR reversed) on this same
 *     account are held against the balance too, so a member can't request
 *     several withdrawals in quick succession and drain more than they
 *     actually have before any of them settle.
 *  5. Per-member daily amount + count limits.
 *  6. Large-withdrawal approval requirement.
 */
export async function checkWithdrawalEligibility(params: {
  savingsAccountId: string;
  amount: number;
}): Promise<WithdrawalCheckResult> {
  const { savingsAccountId, amount } = params;
  const policy = await getWithdrawalPolicy();
  const { savingsToLoanRatio: SAVINGS_TO_LOAN_RATIO } = await getEligibilityPolicy();

  const account = await db.savingsAccount.findUnique({
    where: { id: savingsAccountId },
    include: { member: true },
  });
  if (!account) return { eligible: false, reason: "Savings account not found", availableForWithdrawal: 0 };

  const member = account.member;

  if (member.withdrawalsFrozen) {
    return {
      eligible: false,
      reason: member.frozenReason || "Withdrawals are currently frozen on this account pending investigation. Contact your branch.",
      availableForWithdrawal: 0,
    };
  }

  let penaltyAmount = 0;

  if (account.type === "Shares") {
    return {
      eligible: false,
      reason: "Share capital cannot be withdrawn while you remain an active member. It is refunded only when you exit the SACCO — visit your branch.",
      availableForWithdrawal: 0,
    };
  }

  if (account.type === "Fixed") {
    const matured = account.maturityDate ? account.maturityDate <= new Date() : true;
    if (!matured) {
      if (!policy.fixedEarlyWithdrawalAllowed) {
        return {
          eligible: false,
          reason: `This fixed savings account matures on ${account.maturityDate!.toLocaleDateString("en-UG")} — early withdrawal is not allowed.`,
          availableForWithdrawal: 0,
        };
      }
      penaltyAmount = Math.round(amount * (policy.fixedEarlyWithdrawalPenaltyPercent / 100));
    }
  }

  // Loan-collateral hold, across every Active/Overdue loan this member has.
  const activeLoans = await db.loan.findMany({
    where: { memberId: member.id, status: { in: ["Active", "Overdue"] } },
    select: { principal: true },
  });
  const collateralHold = activeLoans.reduce(
    (sum, loan) => sum + Math.round(loan.principal * SAVINGS_TO_LOAN_RATIO),
    0
  );

  // Race protection: amounts already committed to other in-flight withdrawals.
  const inFlight = await db.savingsTransaction.aggregate({
    where: { savingsAccountId, type: "Withdrawal", status: { in: ["Pending", "PendingApproval"] } },
    _sum: { amount: true },
  });
  const inFlightAmount = inFlight._sum.amount ?? 0;

  const minBalanceReserve = account.type === "Daily" ? policy.minFlexibleSavingsBalance : 0;
  const availableForWithdrawal = Math.max(
    0,
    account.balance - collateralHold - inFlightAmount - minBalanceReserve
  );

  if (amount > availableForWithdrawal) {
    const reasons: string[] = [];
    if (collateralHold > 0) reasons.push(`UGX ${collateralHold.toLocaleString()} is held as loan collateral`);
    if (inFlightAmount > 0) reasons.push(`UGX ${inFlightAmount.toLocaleString()} is already tied up in another pending withdrawal`);
    if (minBalanceReserve > 0) reasons.push(`a minimum balance of UGX ${minBalanceReserve.toLocaleString()} must remain`);
    return {
      eligible: false,
      reason: `Amount exceeds what's available for withdrawal (UGX ${availableForWithdrawal.toLocaleString()})${reasons.length ? " — " + reasons.join("; ") : ""}.`,
      availableForWithdrawal,
    };
  }

  // Per-member daily limits — every account, any non-Failed withdrawal today.
  const todaysWithdrawals = await db.savingsTransaction.findMany({
    where: {
      type: "Withdrawal",
      status: { in: ["Pending", "PendingApproval", "Confirmed"] },
      createdAt: { gte: startOfDay() },
      savingsAccount: { memberId: member.id },
    },
    select: { amount: true },
  });
  const todaysTotal = todaysWithdrawals.reduce((sum, t) => sum + t.amount, 0);

  if (todaysWithdrawals.length >= policy.maxWithdrawalsPerDay) {
    return {
      eligible: false,
      reason: `You've reached today's limit of ${policy.maxWithdrawalsPerDay} withdrawals. Try again tomorrow.`,
      availableForWithdrawal,
    };
  }
  if (todaysTotal + amount > policy.dailyWithdrawalAmountLimit) {
    return {
      eligible: false,
      reason: `This would exceed today's withdrawal limit of UGX ${policy.dailyWithdrawalAmountLimit.toLocaleString()} (UGX ${todaysTotal.toLocaleString()} already withdrawn today).`,
      availableForWithdrawal,
    };
  }

  return {
    eligible: true,
    requiresApproval: amount > policy.largeWithdrawalApprovalThreshold,
    penaltyAmount,
    netPayoutAmount: amount - penaltyAmount,
    availableForWithdrawal,
  };
}
