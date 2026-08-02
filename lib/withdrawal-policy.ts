import "server-only";
import { db } from "@/lib/db";

const SETTINGS_ID = "singleton";

export type WithdrawalPolicy = {
  minFlexibleSavingsBalance: number;
  fixedEarlyWithdrawalAllowed: boolean;
  fixedEarlyWithdrawalPenaltyPercent: number;
  dailyWithdrawalAmountLimit: number;
  maxWithdrawalsPerDay: number;
  largeWithdrawalApprovalThreshold: number;
};

/** Reads the SuperAdmin-editable withdrawal policy, creating the singleton row with schema defaults on first access. */
export async function getWithdrawalPolicy(): Promise<WithdrawalPolicy> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
  return settings;
}

export async function updateWithdrawalPolicy(input: Partial<WithdrawalPolicy>): Promise<WithdrawalPolicy> {
  return db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...input },
    update: input,
  });
}
