import "server-only";
import { db } from "@/lib/db";

const SETTINGS_ID = "singleton";

export type EligibilityPolicy = {
  savingsToLoanRatio: number;
  maxDebtToIncomeRatio: number;
  guarantorExposureLimitUgx: number;
};

/** Reads the SuperAdmin-editable loan eligibility policy, creating the singleton row with schema defaults on first access. */
export async function getEligibilityPolicy(): Promise<EligibilityPolicy> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
  return {
    savingsToLoanRatio: settings.savingsToLoanRatioPercent / 100,
    maxDebtToIncomeRatio: settings.maxDebtToIncomeRatioPercent / 100,
    guarantorExposureLimitUgx: settings.guarantorExposureLimitUgx,
  };
}

export async function updateEligibilityPolicy(input: {
  savingsToLoanRatioPercent: number;
  maxDebtToIncomeRatioPercent: number;
  guarantorExposureLimitUgx: number;
}): Promise<EligibilityPolicy> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...input },
    update: input,
  });
  return {
    savingsToLoanRatio: settings.savingsToLoanRatioPercent / 100,
    maxDebtToIncomeRatio: settings.maxDebtToIncomeRatioPercent / 100,
    guarantorExposureLimitUgx: settings.guarantorExposureLimitUgx,
  };
}
