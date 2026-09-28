import "server-only";
import { db } from "@/lib/db";

const SETTINGS_ID = "singleton";

export type AccountMaintenanceFeePolicy = {
  enabled: boolean;
  amountUgx: number;
};

export async function getAccountMaintenanceFeePolicy(): Promise<AccountMaintenanceFeePolicy> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
  return {
    enabled: settings.accountMaintenanceFeeEnabled,
    amountUgx: settings.accountMaintenanceFeeAmountUgx,
  };
}

export async function updateAccountMaintenanceFeePolicy(
  input: AccountMaintenanceFeePolicy
): Promise<AccountMaintenanceFeePolicy> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      accountMaintenanceFeeEnabled: input.enabled,
      accountMaintenanceFeeAmountUgx: input.amountUgx,
    },
    update: {
      accountMaintenanceFeeEnabled: input.enabled,
      accountMaintenanceFeeAmountUgx: input.amountUgx,
    },
  });
  return {
    enabled: settings.accountMaintenanceFeeEnabled,
    amountUgx: settings.accountMaintenanceFeeAmountUgx,
  };
}
