import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { disbursementSchema } from "@/lib/schemas/loan-application";
import { STATUS_STAGE, canActAtStage } from "@/lib/loan-workflow";
import { disburse as dgatewayDisburse } from "@/lib/dgateway";
import { confirmDisbursement } from "@/lib/payment-confirmation";
import { postLedgerEntries, ACCOUNTS } from "@/lib/ledger";
import { notifyDisbursement } from "@/lib/notify";
import { sendCriticalAlert } from "@/lib/alert";
import type { StaffRole } from "@/components/dashboard/nav-config";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = disbursementSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const application = await db.loanApplication.findUnique({
    where: { id },
    include: {
      guarantors: true,
      collateral: true,
      member: { select: { firstName: true, lastName: true, email: true, phone: true, branchId: true } },
    },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const stage = STATUS_STAGE[application.status];
  if (stage !== "Disbursement") {
    return NextResponse.json({ error: "This application is not awaiting disbursement" }, { status: 400 });
  }

  const role = (session.user as { role?: StaffRole }).role;
  if (!role || !canActAtStage(role, "Disbursement")) {
    return NextResponse.json({ error: "Forbidden — only a Loan Officer or Cashier can disburse" }, { status: 403 });
  }

  if (session.user.id === application.preparedByUserId) {
    return NextResponse.json(
      { error: "You cannot disburse an application you prepared yourself" },
      { status: 403 }
    );
  }

  const { disbursementMethod, comments, phone } = parsed.data;
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? null;

  // Mobile Money: never optimistically complete. Initiate the payout, record
  // the transaction reference, and leave the application PendingDisbursement
  // until the DGateway webhook confirms — only then does the Loan get created.
  if (disbursementMethod === "MobileMoney") {
    const reference = `NGS-DISB-${application.id}-${Date.now()}`;
    try {
      const result = await dgatewayDisburse({
        phone: phone!,
        amountUgx: application.amount,
        reference,
        narration: `Nexcgen loan disbursement — ${application.id}`,
      });

      await db.loanApplication.update({
        where: { id },
        data: { disbursementTransactionRef: result.transactionRef, disbursementInitiatedByUserId: session.user.id },
      });

      await writeAuditLog({
        userId: session.user.id,
        action: "loan_application.disbursement_initiated",
        entityType: "LoanApplication",
        entityId: id,
        newValue: { disbursementMethod, reference: result.transactionRef, phone },
        request: req,
      });

      await invalidateTag(tags.loanApplications);

      // RohoPay's payout call can already report the final outcome
      // synchronously (see lib/dgateway.ts) rather than only via a later
      // webhook — create the loan right away when it does.
      if (result.status === "successful") {
        const confirmResult = await confirmDisbursement(result.transactionRef, req);
        if (confirmResult.ok) {
          return NextResponse.json({
            status: "disbursed",
            message: "Mobile Money payout successful — the loan has been created.",
            transactionRef: result.transactionRef,
          });
        }
      }

      return NextResponse.json({
        status: "pending",
        message: "Mobile Money payout initiated — the loan will be created once DGateway confirms the transaction.",
        transactionRef: result.transactionRef,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      await writeAuditLog({
        userId: session.user.id,
        action: "loan_application.disbursement_failed",
        entityType: "LoanApplication",
        entityId: id,
        newValue: { disbursementMethod, error: message },
        request: req,
      });
      await sendCriticalAlert("Mobile Money loan disbursement failed", {
        loanApplicationId: id,
        member: `${application.member.firstName} ${application.member.lastName}`,
        amount: application.amount,
        initiatedBy: session.user.email,
        error: message,
      });
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Mobile Money disbursement failed" },
        { status: 502 }
      );
    }
  }

  // Cash / Bank: settles immediately — create the Loan now.
  const member = application.member;

  const [loan] = await db.$transaction([
    db.loan.create({
      data: {
        loanApplicationId: id,
        memberId: application.memberId,
        branchId: member.branchId,
        principal: application.amount,
        interestRate: (await db.loanProduct.findUnique({ where: { id: application.loanProductId } }))!
          .interestRate,
        interestMethod: application.interestMethod,
        repaymentPeriodMonths: application.repaymentPeriodMonths,
        disbursedByUserId: session.user.id,
        disbursementMethod,
        status: "Active",
      },
    }),
    db.loanApplication.update({ where: { id }, data: { status: "Disbursed" } }),
    db.approvalStep.create({
      data: {
        loanApplicationId: id,
        stage: "Disbursement",
        userId: session.user.id,
        action: "Approve",
        comments: comments || null,
        ipAddress,
      },
    }),
  ]);

  await Promise.all([
    db.guarantor.updateMany({ where: { loanApplicationId: id }, data: { loanId: loan.id } }),
    db.collateral.updateMany({ where: { loanApplicationId: id }, data: { loanId: loan.id } }),
  ]);

  // Cash pays out of the till; Bank settles through the bank account.
  await postLedgerEntries([
    {
      accountCode: ACCOUNTS.LOANS_RECEIVABLE,
      description: `Loan disbursement — ${loan.id}`,
      debit: application.amount,
      branchId: member.branchId,
      referenceType: "Loan",
      referenceId: loan.id,
    },
    {
      accountCode: disbursementMethod === "Cash" ? ACCOUNTS.CASH : ACCOUNTS.BANK,
      description: `Loan disbursement — ${loan.id}`,
      credit: application.amount,
      branchId: member.branchId,
      referenceType: "Loan",
      referenceId: loan.id,
    },
  ]);

  await writeAuditLog({
    userId: session.user.id,
    action: "loan_application.disbursed",
    entityType: "Loan",
    entityId: loan.id,
    newValue: { disbursementMethod, principal: application.amount },
    request: req,
  });

  await invalidateTag(tags.loanApplications);
  await invalidateTag(tags.loans);
  await invalidateTag(tags.guarantors);

  await notifyDisbursement(
    { name: `${member.firstName} ${member.lastName}`, email: member.email, phone: member.phone },
    application.amount,
    disbursementMethod
  );

  return NextResponse.json({ status: "disbursed", loan });
}
