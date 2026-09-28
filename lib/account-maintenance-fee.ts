import "server-only";
import { db } from "@/lib/db";
import { getAccountMaintenanceFeePolicy } from "@/lib/account-maintenance-fee-policy";
import { postLedgerEntries, ACCOUNTS } from "@/lib/ledger";
import { writeAuditLog } from "@/lib/audit";
import { invalidateTag, tags } from "@/lib/cache";
import { notifyMaintenanceFee } from "@/lib/notify";

/**
 * Charges every Active member's Daily (Flexible) savings account the
 * SuperAdmin-configured monthly maintenance fee (Settings page — off by
 * default). Runs once a month, called from the daily penalty-engine cron
 * (see app/api/cron/penalty-engine/route.ts) rather than its own Vercel
 * Cron entry — this project's Vercel plan caps cron jobs at 2, both already
 * used (penalty-engine, backup), so this piggybacks on the existing daily
 * trigger with an internal "is it the 1st of the month" gate instead of a
 * third registration.
 *
 * Only ever charges a Daily account (the member's main transactional
 * account) — Fixed and Shares accounts are never touched. Skips (never
 * charges a partial amount or drives the balance negative) an account that
 * doesn't have enough to cover the fee, and skips an account already
 * charged this calendar month so a re-run on the same day is a no-op.
 */
export async function runMonthlyAccountMaintenanceFee(): Promise<{
  skipped: true;
  reason: "disabled";
} | {
  skipped: false;
  charged: number;
  alreadyChargedThisMonth: number;
  insufficientBalance: number;
}> {
  const policy = await getAccountMaintenanceFeePolicy();
  if (!policy.enabled) return { skipped: true, reason: "disabled" };

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const accounts = await db.savingsAccount.findMany({
    where: { type: "Daily", member: { status: "Active" } },
    include: {
      member: { select: { firstName: true, lastName: true, email: true, phone: true, branchId: true } },
    },
  });

  let charged = 0;
  let alreadyChargedThisMonth = 0;
  let insufficientBalance = 0;

  for (const account of accounts) {
    const existing = await db.savingsTransaction.findFirst({
      where: { savingsAccountId: account.id, type: "Fee", createdAt: { gte: startOfMonth } },
    });
    if (existing) {
      alreadyChargedThisMonth++;
      continue;
    }

    if (account.balance < policy.amountUgx) {
      insufficientBalance++;
      continue;
    }

    const balanceAfter = account.balance - policy.amountUgx;

    const [, transaction] = await db.$transaction([
      db.savingsAccount.update({ where: { id: account.id }, data: { balance: balanceAfter } }),
      db.savingsTransaction.create({
        data: {
          savingsAccountId: account.id,
          type: "Fee",
          amount: policy.amountUgx,
          balanceAfter,
          branchId: account.member.branchId,
          status: "Confirmed",
          method: "System",
          channel: "System",
        },
      }),
    ]);

    await postLedgerEntries([
      {
        accountCode: ACCOUNTS.SAVINGS_DEPOSITS,
        description: `Monthly account maintenance fee — ${account.accountNumber}`,
        debit: policy.amountUgx,
        branchId: account.member.branchId,
        referenceType: "SavingsTransaction",
        referenceId: transaction.id,
      },
      {
        accountCode: ACCOUNTS.FEE_INCOME,
        description: `Monthly account maintenance fee — ${account.accountNumber}`,
        credit: policy.amountUgx,
        branchId: account.member.branchId,
        referenceType: "SavingsTransaction",
        referenceId: transaction.id,
      },
    ]);

    await writeAuditLog({
      userId: null,
      action: "savings_transaction.maintenance_fee_charged",
      entityType: "SavingsTransaction",
      entityId: transaction.id,
      newValue: { savingsAccountId: account.id, amount: policy.amountUgx, balanceAfter },
    });

    await notifyMaintenanceFee(
      { name: `${account.member.firstName} ${account.member.lastName}`, email: account.member.email, phone: account.member.phone },
      policy.amountUgx,
      balanceAfter
    );

    charged++;
  }

  if (charged > 0) await invalidateTag(tags.savings);

  return { skipped: false, charged, alreadyChargedThisMonth, insufficientBalance };
}
