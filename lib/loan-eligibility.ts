import { db } from "@/lib/db";
import { generateAmortizationSchedule, type InterestMethod } from "@/lib/loan-calculator";
import { getEligibilityPolicy } from "@/lib/eligibility-policy";

export type CheckResult = "pass" | "warn" | "fail" | "not_applicable";

export type EligibilityResult = {
  eligible: boolean;
  riskScore: number; // 0-100, higher = riskier
  flags: string[];
  checks: {
    memberStatus: CheckResult;
    productLimits: CheckResult;
    existingExposure: CheckResult;
    delinquencyHistory: CheckResult;
    guarantorCoverage: CheckResult;
    savingsBalance: CheckResult;
    incomeAffordability: CheckResult;
  };
  /** Populated only when a monthly income figure was supplied. */
  affordability?: {
    monthlyIncome: number;
    maxAffordableInstallment: number;
    projectedInstallment: number;
  };
};

/**
 * Checks member status, product limits, existing loan exposure, delinquency
 * history, guarantor availability, and savings balance, returning a 0–100
 * risk score (higher = riskier) and a pass/fail per check.
 */
export async function checkLoanEligibility(input: {
  memberId: string;
  loanProductId: string;
  requestedAmount: number;
  guarantorMemberIds?: string[];
  /** Declared monthly income (employment + business, summed) for the debt-to-income check. */
  monthlyIncome?: number;
  repaymentPeriodMonths?: number;
}): Promise<EligibilityResult> {
  const flags: string[] = [];
  let riskScore = 0;

  const {
    savingsToLoanRatio: SAVINGS_TO_LOAN_RATIO,
    maxDebtToIncomeRatio: MAX_DEBT_TO_INCOME_RATIO,
    minimumSavingsForLoanUgx: MINIMUM_SAVINGS_FOR_LOAN,
  } = await getEligibilityPolicy();

  const member = await db.member.findUnique({ where: { id: input.memberId } });
  if (!member) throw new Error("Member not found");

  const product = await db.loanProduct.findUnique({ where: { id: input.loanProductId } });
  if (!product) throw new Error("Loan product not found");

  // 1. Member status
  let memberStatus: CheckResult = "pass";
  if (member.status !== "Active") {
    memberStatus = "fail";
    flags.push(`Member status is ${member.status}, not Active`);
    riskScore += 50;
  }

  // 2. Product limits
  let productLimits: CheckResult = "pass";
  if (input.requestedAmount < product.minAmount || input.requestedAmount > product.maxAmount) {
    productLimits = "fail";
    flags.push(
      `Requested amount is outside this product's range (${product.minAmount}–${product.maxAmount})`
    );
    riskScore += 30;
  }

  // 3. Existing exposure — outstanding principal across active/overdue loans
  const activeLoans = await db.loan.findMany({
    where: { memberId: input.memberId, status: { in: ["Active", "Overdue"] } },
    include: { repayments: true },
  });
  const existingExposure = activeLoans.reduce((sum, loan) => {
    const repaidPrincipal = loan.repayments.reduce((s, r) => s + r.principalPortion, 0);
    return sum + Math.max(loan.principal - repaidPrincipal, 0);
  }, 0);

  let existingExposureCheck: CheckResult = "pass";
  const totalExposureAfter = existingExposure + input.requestedAmount;
  if (totalExposureAfter > product.maxAmount * 2) {
    existingExposureCheck = "fail";
    flags.push(`Total exposure after this loan (${totalExposureAfter}) is too high`);
    riskScore += 25;
  } else if (existingExposure > 0) {
    existingExposureCheck = "warn";
    flags.push(`Member already has ${existingExposure} in outstanding loan exposure`);
    riskScore += 10;
  }

  // 4. Delinquency history
  const defaultedCount = await db.loan.count({
    where: { memberId: input.memberId, status: "Defaulted" },
  });
  const overdueCount = await db.loan.count({
    where: { memberId: input.memberId, status: "Overdue" },
  });

  let delinquencyHistory: CheckResult = "pass";
  if (defaultedCount > 0) {
    delinquencyHistory = "fail";
    flags.push("Member has a defaulted loan on record");
    riskScore += 40;
  } else if (overdueCount > 0) {
    delinquencyHistory = "warn";
    flags.push("Member currently has an overdue loan");
    riskScore += 20;
  }

  // 5. Guarantor coverage
  let guarantorCoverage: CheckResult = "not_applicable";
  if (input.guarantorMemberIds && input.guarantorMemberIds.length > 0) {
    const blockedGuarantors = await db.guarantor.findMany({
      where: { memberId: { in: input.guarantorMemberIds }, status: "Blocked" },
    });
    guarantorCoverage = blockedGuarantors.length > 0 ? "fail" : "pass";
    if (blockedGuarantors.length > 0) {
      flags.push("One or more guarantors are blocked (guarantee limit already exceeded)");
      riskScore += 30;
    }
  } else if (input.requestedAmount > product.minAmount * 3) {
    guarantorCoverage = "warn";
    flags.push("Large loan amount with no guarantors attached");
    riskScore += 15;
  }

  // 6. Savings balance — collateral-savings convention (see SAVINGS_TO_LOAN_RATIO).
  const savingsAgg = await db.savingsAccount.aggregate({
    where: { memberId: input.memberId },
    _sum: { balance: true },
  });
  const savingsBalance = savingsAgg._sum.balance ?? 0;
  const requiredSavings = Math.round(input.requestedAmount * SAVINGS_TO_LOAN_RATIO);

  // A flat minimum floor (admin-configurable, see Settings → Loan eligibility
  // policy) always blocks outright — the ratio check below only ever warns,
  // which would otherwise let a member with a small-but-nonzero balance
  // qualify for an equally small loan despite not meeting the SACCO's
  // baseline savings requirement.
  let savingsCheck: CheckResult = "pass";
  if (savingsBalance < MINIMUM_SAVINGS_FOR_LOAN) {
    savingsCheck = "fail";
    flags.push(
      `Savings balance (${savingsBalance}) is below the minimum required to qualify for any loan (${MINIMUM_SAVINGS_FOR_LOAN})`
    );
    riskScore += 25;
  } else if (savingsBalance < requiredSavings) {
    savingsCheck = "warn";
    flags.push(
      `Savings balance (${savingsBalance}) is below the recommended ${SAVINGS_TO_LOAN_RATIO * 100}% of the requested amount (${requiredSavings})`
    );
    riskScore += 15;
  }

  // 7. Income affordability — the installment on THIS loan must not exceed
  // MAX_DEBT_TO_INCOME_RATIO of the applicant's declared monthly income.
  let incomeAffordability: CheckResult = "not_applicable";
  let affordability: EligibilityResult["affordability"];
  if (input.monthlyIncome && input.monthlyIncome > 0 && input.repaymentPeriodMonths) {
    const schedule = generateAmortizationSchedule({
      principal: input.requestedAmount,
      monthlyRatePercent: product.interestRate,
      periodMonths: input.repaymentPeriodMonths,
      method: product.interestMethod as InterestMethod,
    });
    const projectedInstallment = schedule.monthlyInstallment ?? schedule.rows[0]?.installment ?? 0;
    const maxAffordableInstallment = Math.round(input.monthlyIncome * MAX_DEBT_TO_INCOME_RATIO);
    affordability = { monthlyIncome: input.monthlyIncome, maxAffordableInstallment, projectedInstallment };

    if (projectedInstallment > maxAffordableInstallment) {
      incomeAffordability = "fail";
      flags.push(
        `Projected installment (${projectedInstallment}) exceeds ${MAX_DEBT_TO_INCOME_RATIO * 100}% of declared monthly income (max affordable ${maxAffordableInstallment})`
      );
      riskScore += 35;
    }
  }

  riskScore = Math.min(riskScore, 100);

  const eligible =
    memberStatus === "pass" &&
    productLimits === "pass" &&
    existingExposureCheck !== "fail" &&
    delinquencyHistory !== "fail" &&
    guarantorCoverage !== "fail" &&
    savingsCheck !== "fail" &&
    incomeAffordability !== "fail";

  return {
    eligible,
    riskScore,
    flags,
    checks: {
      memberStatus,
      productLimits,
      existingExposure: existingExposureCheck,
      delinquencyHistory,
      guarantorCoverage,
      savingsBalance: savingsCheck,
      incomeAffordability,
    },
    affordability,
  };
}

/**
 * A guarantor's total exposure across every guarantee they've given (blocked
 * guarantees still represent real financial commitment, so ALL of a
 * member's guarantee records count — `status` only gates whether they may
 * take on further NEW guarantees, not whether existing ones count).
 */
export async function getGuarantorExposure(memberId: string) {
  const guarantees = await db.guarantor.findMany({ where: { memberId } });
  const totalExposure = guarantees.reduce((sum, g) => sum + g.guaranteeAmount, 0);
  return { totalExposure, guaranteeCount: guarantees.length, guarantees };
}

/**
 * Re-evaluates every given member's total guarantee exposure and
 * auto-blocks (or unblocks) ALL their Guarantor records against the
 * SuperAdmin-configured guarantorExposureLimitUgx (see lib/eligibility-policy.ts).
 * Called after any guarantee is added or released so limits stay enforced
 * without a manual review step.
 */
export async function enforceGuarantorLimits(memberIds: string[]): Promise<void> {
  const { guarantorExposureLimitUgx } = await getEligibilityPolicy();
  for (const memberId of memberIds) {
    const { totalExposure } = await getGuarantorExposure(memberId);
    const shouldBlock = totalExposure > guarantorExposureLimitUgx;

    await db.guarantor.updateMany({
      where: { memberId },
      data: { status: shouldBlock ? "Blocked" : "Active" },
    });
  }
}
