import { db } from "@/lib/db";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { postLedgerEntries, buildRepaymentLedgerLines, buildSavingsLedgerLines, ACCOUNTS } from "@/lib/ledger";
import { notifyDisbursement } from "@/lib/notify";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";

// RohoPay confirms HMAC-SHA256 webhook signatures but docs.rohopay.com's
// /guides/* pages (which would name the exact header + payload shape)
// 404'd on every fetch attempt during this integration (see lib/dgateway.ts
// header comment). This checks both commonly-used header names against an
// HMAC-SHA256 of the raw body — if RohoPay uses a different header, every
// real webhook will 401 (fails closed / loudly, never silently accepts an
// unverified event) until the header name is corrected here.
const SIGNATURE_HEADER_CANDIDATES = ["x-roho-signature", "x-webhook-signature", "x-signature"];

function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.ROHO_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");

  for (const headerName of SIGNATURE_HEADER_CANDIDATES) {
    const provided = headers.get(headerName);
    if (!provided) continue;
    const providedBuf = Buffer.from(provided, "utf8");
    if (providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

// Payload field names are likewise unconfirmed (webhook docs 404'd), but
// data.reference/data.transaction_id/data.status are CONFIRMED live as the
// /api/v1/collect response's field names (see lib/dgateway.ts) — webhooks
// most likely reuse the same {success,data,error} envelope and field names,
// so those are checked first, with a flat top-level shape as a fallback.
const webhookSchema = z.object({
  reference: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  type: z.enum(["collection", "payout"]).optional(),
  event: z.string().optional(),
  data: z
    .object({
      reference: z.string().optional(),
      transaction_id: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  // Fail CLOSED: this endpoint moves real money state (creates loans,
  // confirms repayments) — an unset secret must reject every request, not
  // silently trust whatever is posted to it.
  if (!process.env.ROHO_WEBHOOK_SECRET) {
    console.error("[dgateway/webhook] ROHO_WEBHOOK_SECRET is not set — refusing all requests");
    return NextResponse.json({ error: "Server misconfigured: ROHO_WEBHOOK_SECRET not set" }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });

  const reference = parsed.data.data?.reference ?? parsed.data.data?.transaction_id ?? parsed.data.reference;
  const rawStatus = (parsed.data.status ?? parsed.data.data?.status ?? "").toLowerCase();
  const status: "successful" | "failed" = ["successful", "success", "completed"].includes(rawStatus)
    ? "successful"
    : "failed";
  const type: "collection" | "payout" =
    parsed.data.type ?? (parsed.data.event?.toLowerCase().includes("payout") ? "payout" : "collection");

  if (!reference) return NextResponse.json({ error: "Invalid webhook payload: missing reference" }, { status: 400 });

  if (type === "payout") {
    const application = await db.loanApplication.findFirst({
      where: { disbursementTransactionRef: reference },
    });
    if (!application) return NextResponse.json({ error: "No matching disbursement" }, { status: 404 });

    if (status === "failed") {
      await db.loanApplication.update({
        where: { id: application.id },
        data: { disbursementTransactionRef: null },
      });
      await writeAuditLog({
        userId: null,
        action: "loan_application.disbursement_failed_webhook",
        entityType: "LoanApplication",
        entityId: application.id,
        newValue: { reference },
        request: req,
      });
      await invalidateTag(tags.loanApplications);
      return NextResponse.json({ acknowledged: true });
    }

    const member = await db.member.findUnique({ where: { id: application.memberId } });
    const loanProduct = await db.loanProduct.findUnique({ where: { id: application.loanProductId } });
    if (!member || !loanProduct) {
      return NextResponse.json({ error: "Member or loan product no longer exists" }, { status: 409 });
    }

    // Whoever clicked "Disburse" to kick off this Mobile Money payout — this
    // webhook runs with no staff session, so it can't fall back to "whoever
    // is logged in right now" the way the Cash/Bank path does.
    const disbursedByUserId = application.disbursementInitiatedByUserId ?? application.preparedByUserId;
    if (!disbursedByUserId) {
      return NextResponse.json({ error: "No staff member recorded for this disbursement" }, { status: 409 });
    }

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

    return NextResponse.json({ acknowledged: true, loanId: loan.id });
  }

  // A "collection" reference is either a loan repayment or a savings
  // deposit — check savings first since its reference prefix (NGS-SDEP-) is
  // distinct from a repayment's (NGS-MRPY-), but match by lookup either way
  // rather than trusting the prefix string.
  const pendingSavingsTxn = await db.savingsTransaction.findFirst({
    where: { transactionId: reference, status: "Pending" },
    include: { savingsAccount: { include: { member: { select: { firstName: true, lastName: true, email: true, phone: true } } } } },
  });
  if (pendingSavingsTxn) {
    if (status === "failed") {
      await db.savingsTransaction.update({ where: { id: pendingSavingsTxn.id }, data: { status: "Failed" } });
      await writeAuditLog({
        userId: null,
        action: "savings_transaction.member_deposit_failed_webhook",
        entityType: "SavingsTransaction",
        entityId: pendingSavingsTxn.id,
        newValue: { reference },
        request: req,
      });
      await invalidateTag(tags.savings);
      return NextResponse.json({ acknowledged: true });
    }

    await db.$transaction([
      db.savingsTransaction.update({ where: { id: pendingSavingsTxn.id }, data: { status: "Confirmed" } }),
      db.savingsAccount.update({
        where: { id: pendingSavingsTxn.savingsAccountId },
        data: { balance: { increment: pendingSavingsTxn.amount } },
      }),
    ]);

    await postLedgerEntries(
      buildSavingsLedgerLines(
        {
          id: pendingSavingsTxn.id,
          referenceType: "SavingsTransaction",
          description: `Member self-service deposit (Mobile Money) — ${pendingSavingsTxn.savingsAccountId}`,
          type: "Deposit",
          amount: pendingSavingsTxn.amount,
          branchId: pendingSavingsTxn.branchId,
        },
        ACCOUNTS.BANK
      )
    );

    await writeAuditLog({
      userId: null,
      action: "savings_transaction.member_deposit_confirmed_webhook",
      entityType: "SavingsTransaction",
      entityId: pendingSavingsTxn.id,
      newValue: { reference, amount: pendingSavingsTxn.amount },
      request: req,
    });

    await invalidateTag(tags.savings);
    return NextResponse.json({ acknowledged: true, savingsTransactionId: pendingSavingsTxn.id });
  }

  // Repayment collection confirmation
  const repayment = await db.repayment.findFirst({ where: { transactionId: reference } });
  if (!repayment) return NextResponse.json({ error: "No matching repayment" }, { status: 404 });

  await db.repayment.update({
    where: { id: repayment.id },
    data: { status: status === "successful" ? "Confirmed" : "Failed" },
  });

  if (status === "successful") {
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
  }

  await writeAuditLog({
    userId: null,
    action: status === "successful" ? "repayment.confirmed_webhook" : "repayment.failed_webhook",
    entityType: "Repayment",
    entityId: repayment.id,
    newValue: { reference },
    request: req,
  });

  await invalidateTag(tags.loans);
  await invalidateTag(tags.repayments);
  return NextResponse.json({ acknowledged: true });
}
