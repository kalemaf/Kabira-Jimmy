import "server-only";
import { db } from "@/lib/db";

const SETTINGS_ID = "singleton";

/** Whole-number percent (20 = 20%) — see SystemSettings.mobileMoneyRepaymentFeePercent. */
export async function getMobileMoneyRepaymentFeePercent(): Promise<number> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
  return settings.mobileMoneyRepaymentFeePercent;
}

export async function updateMobileMoneyRepaymentFeePercent(percent: number): Promise<number> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, mobileMoneyRepaymentFeePercent: percent },
    update: { mobileMoneyRepaymentFeePercent: percent },
  });
  return settings.mobileMoneyRepaymentFeePercent;
}
