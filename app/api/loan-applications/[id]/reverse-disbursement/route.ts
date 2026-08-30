import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { postLedgerEntries, ACCOUNTS } from "@/lib/ledger";
import { z } from "zod";
import { NextResponse } from "next/server";

const reverseDisbursementSchema = z.object({
  reason: z.string().min(10, "Explain why this disbursement is being reversed"),
});

/**
 * Undoes a Cash/Bank disbursement that was recorded but never actually
 * delivered to the member (e.g. staff confirmed the wrong method, or the
 * member disputes receiving the funds). Only safe while the loan has no
 * repayment history — a loan already being repaid or already in recovery
 * must be handled as a write-off instead of an outright reversal, since
 * reversing it would erase real transactions against it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = reverseDisbursementSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const application = await db.loanApplication.findUnique({
    where: { id },
    include: {
      loan: { include: { repayments: true, recoveryCase: true } },
      member: { select: { branchId: true, firstName: true, lastName: true } },
    },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (application.status !== "Disbursed" || !application.loan) {
    return NextResponse.json({ error: "This application has no disbursed loan to reverse" }, { status: 400 });
  }

  const loan = application.loan;
  if (loan.repayments.length > 0) {
    return NextResponse.json(
      { error: "This loan already has repayment history and cannot be reversed — it must be handled as a write-off instead" },
      { status: 409 }
    );
  }
  if (loan.recoveryCase) {
    return NextResponse.json({ error: "This loan has a recovery case attached and cannot be reversed" }, { status: 409 });
  }

  const branchId = application.member.branchId;
  const cashAccountCode = loan.disbursementMethod === "Bank" ? ACCOUNTS.BANK : ACCOUNTS.CASH;

  await db.$transaction([
    db.loan.delete({ where: { id: loan.id } }),
    db.loanApplication.update({
      where: { id },
      data: { status: "PendingDisbursement", disbursementTransactionRef: null, disbursementInitiatedByUserId: null },
    }),
  ]);

  // Mirror-image of the original disbursement post (see disburse/route.ts) —
  // reversing entries, not a deletion, so the original post stays in the
  // ledger's history and this correction is independently auditable.
  await postLedgerEntries([
    {
      accountCode: ACCOUNTS.LOANS_RECEIVABLE,
      description: `Reversal — disbursement never delivered (${loan.id})`,
      credit: loan.principal,
      branchId,
      referenceType: "Loan",
      referenceId: loan.id,
    },
    {
      accountCode: cashAccountCode,
      description: `Reversal — disbursement never delivered (${loan.id})`,
      debit: loan.principal,
      branchId,
      referenceType: "Loan",
      referenceId: loan.id,
    },
  ]);

  await writeAuditLog({
    userId: session.user.id,
    action: "loan_application.disbursement_reversed",
    entityType: "Loan",
    entityId: loan.id,
    oldValue: {
      principal: loan.principal,
      disbursementMethod: loan.disbursementMethod,
      disbursedByUserId: loan.disbursedByUserId,
      disbursedAt: loan.disbursedAt,
    },
    newValue: { reason: parsed.data.reason, applicationStatus: "PendingDisbursement" },
    request: req,
  });

  await invalidateTag(tags.loanApplications);
  await invalidateTag(tags.loans);
  await invalidateTag(tags.guarantors);

  return NextResponse.json({ status: "reversed" });
}
