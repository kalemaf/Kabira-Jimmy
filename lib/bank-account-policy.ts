import "server-only";
import { db } from "@/lib/db";

const SETTINGS_ID = "singleton";

export type BankAccountDetails = {
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
};

export async function getBankAccountDetails(): Promise<BankAccountDetails> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
  return {
    bankName: settings.bankName,
    bankAccountName: settings.bankAccountName,
    bankAccountNumber: settings.bankAccountNumber,
    bankBranch: settings.bankBranch,
  };
}

export async function updateBankAccountDetails(details: BankAccountDetails): Promise<BankAccountDetails> {
  const settings = await db.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...details },
    update: details,
  });
  return {
    bankName: settings.bankName,
    bankAccountName: settings.bankAccountName,
    bankAccountNumber: settings.bankAccountNumber,
    bankBranch: settings.bankBranch,
  };
}

/** Whether an admin has actually filled these in yet — used to hide the Bank Transfer option until they have. */
export function isBankAccountConfigured(details: BankAccountDetails): boolean {
  return !!(details.bankName && details.bankAccountName && details.bankAccountNumber);
}
