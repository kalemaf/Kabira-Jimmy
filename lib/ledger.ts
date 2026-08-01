import { db } from "@/lib/db";
import { ACCOUNTS } from "@/lib/account-codes";

export { ACCOUNTS } from "@/lib/account-codes";

export type LedgerLine = {
  accountCode: string;
  description: string;
  debit?: number;
  credit?: number;
  branchId: string;
  referenceType?: string;
  referenceId?: string;
};

/**
 * Posts a set of ledger lines as one atomic write. Throws if the lines
 * don't balance (total debits !== total credits) — a caller passing an
 * unbalanced double-entry post is a bug, and a broken ledger is worse than
 * a failed request.
 */
export async function postLedgerEntries(lines: LedgerLine[]): Promise<void> {
  if (lines.length === 0) return;

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced ledger post: debits=${totalDebit} credits=${totalCredit}`);
  }

  await db.ledgerEntry.createMany({
    data: lines.map((l) => ({
      accountCode: l.accountCode,
      description: l.description,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
      branchId: l.branchId,
      referenceType: l.referenceType ?? null,
      referenceId: l.referenceId ?? null,
    })),
  });
}

/**
 * Builds the balanced ledger lines for a confirmed repayment: cash/bank in,
 * split across principal (reduces Loans Receivable), interest, and penalty
 * (both revenue). Shared by the direct (Cash/Bank/Cheque/Online) repayment
 * path and the Mobile Money webhook confirmation path so the accounting
 * treatment can't drift between them.
 */
export function buildRepaymentLedgerLines(
  repayment: {
    id: string;
    receiptNumber: string;
    amountPaid: number;
    principalPortion: number;
    interestPortion: number;
    penaltyPortion: number;
    branchId: string;
  },
  /** Which asset account received the cash-in. Defaults to Cash (in-person collection); pass ACCOUNTS.BANK for Mobile Money/Bank/Online/Cheque. */
  debitAccountCode: string = ACCOUNTS.CASH
): LedgerLine[] {
  const lines: LedgerLine[] = [
    {
      accountCode: debitAccountCode,
      description: `Repayment — ${repayment.receiptNumber}`,
      debit: repayment.amountPaid,
      branchId: repayment.branchId,
      referenceType: "Repayment",
      referenceId: repayment.id,
    },
  ];
  if (repayment.principalPortion > 0) {
    lines.push({
      accountCode: ACCOUNTS.LOANS_RECEIVABLE,
      description: `Principal — ${repayment.receiptNumber}`,
      credit: repayment.principalPortion,
      branchId: repayment.branchId,
      referenceType: "Repayment",
      referenceId: repayment.id,
    });
  }
  if (repayment.interestPortion > 0) {
    lines.push({
      accountCode: ACCOUNTS.INTEREST_INCOME,
      description: `Interest — ${repayment.receiptNumber}`,
      credit: repayment.interestPortion,
      branchId: repayment.branchId,
      referenceType: "Repayment",
      referenceId: repayment.id,
    });
  }
  if (repayment.penaltyPortion > 0) {
    lines.push({
      accountCode: ACCOUNTS.PENALTY_INCOME,
      description: `Penalty — ${repayment.receiptNumber}`,
      credit: repayment.penaltyPortion,
      branchId: repayment.branchId,
      referenceType: "Repayment",
      referenceId: repayment.id,
    });
  }
  return lines;
}

/**
 * Builds the balanced ledger lines for a savings deposit or withdrawal:
 * cash moves one way, the Savings Deposits liability moves the other.
 * Shared by account-opening deposits, staff-recorded transactions, and
 * member-portal self-service deposits so the accounting treatment can't
 * drift between the three entry points.
 */
export function buildSavingsLedgerLines(
  entry: {
    id: string;
    /** "SavingsAccount" for an opening deposit, "SavingsTransaction" otherwise. */
    referenceType: "SavingsAccount" | "SavingsTransaction";
    description: string;
    type: "Deposit" | "Withdrawal";
    amount: number;
    branchId: string;
  },
  /** Which asset account cash moves through. Defaults to Cash (in-person/opening); pass ACCOUNTS.BANK for non-cash channels. */
  cashAccountCode: string = ACCOUNTS.CASH
): LedgerLine[] {
  const base = {
    branchId: entry.branchId,
    referenceType: entry.referenceType,
    referenceId: entry.id,
    description: entry.description,
  };
  const cashLine = { ...base, accountCode: cashAccountCode };
  const savingsLine = { ...base, accountCode: ACCOUNTS.SAVINGS_DEPOSITS };

  return entry.type === "Deposit"
    ? [{ ...cashLine, debit: entry.amount }, { ...savingsLine, credit: entry.amount }]
    : [{ ...savingsLine, debit: entry.amount }, { ...cashLine, credit: entry.amount }];
}
