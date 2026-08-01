import "server-only";
import { db } from "@/lib/db";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { postLedgerEntries, buildRepaymentLedgerLines, buildSavingsLedgerLines, ACCOUNTS } from "@/lib/ledger";
import { notifyDisbursement } from "@/lib/notify";

/**
 * Confirms/fails Pending Mobile Money records by RohoPay transaction
 * reference. Single source of truth shared by two callers that both need to
 * apply the exact same balance-update/ledger-posting logic:
 *  - app/api/dgateway/webhook/route.ts, when RohoPay's webhook reports a
 *    final status asynchronously.
 *  - the routes that call lib/dgateway.ts's collectPayment()/disburse()
 *    directly, when RohoPay's own API response ALREADY reports the final
 *    status synchronously (confirmed live — RohoPay's /api/v1/collect can
 *    return status: "successful" in the initiating response itself, not
 *    just via a later webhook).
 * Two independent confirmation paths for the same event is deliberate
 * defense-in-depth, not redundancy: whichever arrives never conflicts,
 * because both paths only act on a still-Pending record (findFirst re-reads
 * status), so a race where both fire is a harmless no-op for the second one.
 */

type ConfirmResult = { ok: true; alreadyResolved?: boolean } | { ok: false; reason: "not_found" };

export async function confirmSavingsDeposit(reference: string, req?: Request): Promise<ConfirmResult> {
  const pending = await db.savingsTransaction.findFirst({
    where: { transactionId: reference, status: "Pending" },
    include: { savingsAccount: { select: { accountNumber: true } } },
  });
  if (!pending) {
    const alreadyResolved = await db.savingsTransaction.findFirst({ where: { transactionId: reference } });
    return alreadyResolved ? { ok: true, alreadyResolved: true } : { ok: false, reason: "not_found" };
  }

  await db.$transaction([
    db.savingsTransaction.update({ where: { id: pending.id }, data: { status: "Confirmed" } }),
    db.savingsAccount.update({
      where: { id: pending.savingsAccountId },
      data: { balance: { increment: pending.amount } },
    }),
  ]);

  await postLedgerEntries(
    buildSavingsLedgerLines(
      {
        id: pending.id,
        referenceType: "SavingsTransaction",
        description: `Member self-service deposit (Mobile Money) — ${pending.savingsAccount.accountNumber}`,
        type: "Deposit",
        amount: pending.amount,
        branchId: pending.branchId,
      },
      ACCOUNTS.BANK
    )
  );

  await writeAuditLog({
    userId: null,
    action: "savings_transaction.member_deposit_confirmed_webhook",
    entityType: "SavingsTransaction",
    entityId: pending.id,
    newValue: { reference, amount: pending.amount },
    request: req,
  });

  await invalidateTag(tags.savings);
  return { ok: true };
}

export async function failSavingsDeposit(reference: string, req?: Request): Promise<ConfirmResult> {
  const pending = await db.savingsTransaction.findFirst({ where: { transactionId: reference, status: "Pending" } });
  if (!pending) return { ok: false, reason: "not_found" };

  await db.savingsTransaction.update({ where: { id: pending.id }, data: { status: "Failed" } });
  await writeAuditLog({
    userId: null,
    action: "savings_transaction.member_deposit_failed_webhook",
    entityType: "SavingsTransaction",
    entityId: pending.id,
    newValue: { reference },
    request: req,
  });
  await invalidateTag(tags.savings);
  return { ok: true };
}

export async function confirmRepayment(reference: string, req?: Request): Promise<ConfirmResult> {
  const pending = await db.repayment.findFirst({ where: { transactionId: reference, status: "Pending" } });
  if (!pending) {
    const alreadyResolved = await db.repayment.findFirst({ where: { transactionId: reference } });
    return alreadyResolved ? { ok: true, alreadyResolved: true } : { ok: false, reason: "not_found" };
  }

  const repayment = await db.repayment.update({ where: { id: pending.id }, data: { status: "Confirmed" } });

  const loan = await db.loan.findUnique({
    where: { id: repayment.loanId },
    include: { repayments: { where: { status: "Confirmed" } } },
  });
  if (loan) {
    await postLedgerEntries(buildRepaymentLedgerLines(repayment, ACCOUNTS.BANK));

    const totalRepaidPrincipal = loan.repayments.reduce((sum, r) => sum + r.principalPortion, 0);
    if (totalRepaidPrincipal >= loan.principal) {
      await db.loan.update({ where: { id: loan.id }, data: { status: "PaidOff" } });
    }
  }

  await writeAuditLog({
    userId: null,
    action: "repayment.confirmed_webhook",
    entityType: "Repayment",
    entityId: repayment.id,
    newValue: { reference },
    request: req,
  });

  await invalidateTag(tags.loans);
  await invalidateTag(tags.repayments);
  return { ok: true };
}

export async function failRepayment(reference: string, req?: Request): Promise<ConfirmResult> {
  const pending = await db.repayment.findFirst({ where: { transactionId: reference, status: "Pending" } });
  if (!pending) return { ok: false, reason: "not_found" };

  await db.repayment.update({ where: { id: pending.id }, data: { status: "Failed" } });
  await writeAuditLog({
    userId: null,
    action: "repayment.failed_webhook",
    entityType: "Repayment",
    entityId: pending.id,
    newValue: { reference },
    request: req,
  });
  await invalidateTag(tags.loans);
  await invalidateTag(tags.repayments);
  return { ok: true };
}

export async function confirmDisbursement(reference: string, req?: Request): Promise<ConfirmResult> {
  const application = await db.loanApplication.findFirst({
    where: { disbursementTransactionRef: reference },
    include: {
      member: { select: { firstName: true, lastName: true, email: true, phone: true, branchId: true } },
    },
  });
  if (!application) return { ok: false, reason: "not_found" };
  if (application.status === "Disbursed") return { ok: true, alreadyResolved: true };

  const member = application.member;
  const loanProduct = await db.loanProduct.findUnique({ where: { id: application.loanProductId } });
  if (!loanProduct) return { ok: false, reason: "not_found" };

  const disbursedByUserId = application.disbursementInitiatedByUserId ?? application.preparedByUserId;
  if (!disbursedByUserId) return { ok: false, reason: "not_found" };

  const [loan] = await db.$transaction([
    db.loan.create({
      data: {
        loanApplicationId: application.id,
        memberId: application.memberId,
        branchId: member.branchId,
        principal: application.amount,
        interestRate: loanProduct.interestRate,
        interestMethod: application.interestMethod,
        repaymentPeriodMonths: application.repaymentPeriodMonths,
        disbursedByUserId,
        disbursementMethod: "MobileMoney",
        status: "Active",
      },
    }),
    db.loanApplication.update({ where: { id: application.id }, data: { status: "Disbursed" } }),
  ]);

  await Promise.all([
    db.guarantor.updateMany({ where: { loanApplicationId: application.id }, data: { loanId: loan.id } }),
    db.collateral.updateMany({ where: { loanApplicationId: application.id }, data: { loanId: loan.id } }),
  ]);

  await postLedgerEntries([
    {
      accountCode: ACCOUNTS.LOANS_RECEIVABLE,
      description: `Loan disbursement (Mobile Money) — ${loan.id}`,
      debit: application.amount,
      branchId: member.branchId,
      referenceType: "Loan",
      referenceId: loan.id,
    },
    {
      accountCode: ACCOUNTS.BANK,
      description: `Loan disbursement (Mobile Money) — ${loan.id}`,
      credit: application.amount,
      branchId: member.branchId,
      referenceType: "Loan",
      referenceId: loan.id,
    },
  ]);

  await writeAuditLog({
    userId: null,
    action: "loan_application.disbursement_confirmed_webhook",
    entityType: "Loan",
    entityId: loan.id,
    newValue: { reference },
    request: req,
  });

  await invalidateTag(tags.loanApplications);
  await invalidateTag(tags.loans);
  await invalidateTag(tags.guarantors);

  await notifyDisbursement(
    { name: `${member.firstName} ${member.lastName}`, email: member.email, phone: member.phone },
    application.amount,
    "MobileMoney"
  );

  return { ok: true };
}

export async function failDisbursement(reference: string, req?: Request): Promise<ConfirmResult> {
  const application = await db.loanApplication.findFirst({ where: { disbursementTransactionRef: reference } });
  if (!application || application.status === "Disbursed") return { ok: false, reason: "not_found" };

  await db.loanApplication.update({ where: { id: application.id }, data: { disbursementTransactionRef: null } });
  await writeAuditLog({
    userId: null,
    action: "loan_application.disbursement_failed_webhook",
    entityType: "LoanApplication",
    entityId: application.id,
    newValue: { reference },
    request: req,
  });
  await invalidateTag(tags.loanApplications);
  return { ok: true };
}
