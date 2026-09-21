import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { postLedgerEntries, ACCOUNTS } from "@/lib/ledger";
import { generateAmortizationSchedule } from "@/lib/loan-calculator";
import { NextResponse } from "next/server";
import { z } from "zod";

const adjustmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("WriteOff"), amount: z.number().int().positive(), reason: z.string().min(10) }),
  z.object({
    type: z.literal("Reschedule"),
    newRepaymentPeriodMonths: z.number().int().positive(),
    reason: z.string().min(10),
  }),
  z.object({ type: z.literal("InterestWaiver"), amount: z.number().int().positive(), reason: z.string().min(10) }),
]);

/**
 * Restructures an already-disbursed loan — write-off, reschedule, or
 * interest waiver — as an audited LoanAdjustment (see prisma/schema.prisma),
 * rather than mutating Loan fields with no record of why. Single-approver
 * with a mandatory reason, same precedent as
 * app/api/loan-applications/[id]/reverse-disbursement/route.ts: this acts on
 * a loan that's already cleared the full maker-checker approval chain once,
 * so it's a documented management decision, not a new disbursement.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = adjustmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const loan = await db.loan.findUnique({
    where: { id },
    include: {
      repayments: { where: { status: "Confirmed" } },
      adjustments: true,
      loanApplication: { include: { loanProduct: true } },
    },
  });
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  if (loan.status === "PaidOff" || loan.status === "WrittenOff") {
    return NextResponse.json({ error: `This loan is already ${loan.status} and cannot be restructured` }, { status: 400 });
  }

  const data = parsed.data;

  if (data.type === "Reschedule") {
    if (data.newRepaymentPeriodMonths === loan.repaymentPeriodMonths) {
      return NextResponse.json({ error: "New repayment period must differ from the current one" }, { status: 400 });
    }

    const [, adjustment] = await db.$transaction([
      db.loan.update({ where: { id }, data: { repaymentPeriodMonths: data.newRepaymentPeriodMonths } }),
      db.loanAdjustment.create({
        data: {
          loanId: id,
          type: "Reschedule",
          previousRepaymentPeriodMonths: loan.repaymentPeriodMonths,
          newRepaymentPeriodMonths: data.newRepaymentPeriodMonths,
          reason: data.reason,
          requestedByUserId: session.user.id,
        },
      }),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "loan.rescheduled",
      entityType: "Loan",
      entityId: id,
      oldValue: { repaymentPeriodMonths: loan.repaymentPeriodMonths },
      newValue: { repaymentPeriodMonths: data.newRepaymentPeriodMonths, reason: data.reason },
      request: req,
    });
    await invalidateTag(tags.loans);
    return NextResponse.json(adjustment, { status: 201 });
  }

  const repaidPrincipal = loan.repayments.reduce((sum, r) => sum + r.principalPortion, 0);
  const repaidInterest = loan.repayments.reduce((sum, r) => sum + r.interestPortion, 0);
  const existingWriteOff = loan.adjustments
    .filter((a) => a.type === "WriteOff")
    .reduce((sum, a) => sum + (a.amount ?? 0), 0);
  const existingWaived = loan.adjustments
    .filter((a) => a.type === "InterestWaiver")
    .reduce((sum, a) => sum + (a.amount ?? 0), 0);

  if (data.type === "WriteOff") {
    const outstandingPrincipal = Math.max(loan.principal - repaidPrincipal - existingWriteOff, 0);
    if (data.amount > outstandingPrincipal) {
      return NextResponse.json(
        { error: `Cannot write off more than the outstanding principal (${outstandingPrincipal})` },
        { status: 400 }
      );
    }

    const fullyWrittenOff = data.amount >= outstandingPrincipal;

    const [, adjustment] = await db.$transaction([
      db.loan.update({ where: { id }, data: fullyWrittenOff ? { status: "WrittenOff" } : {} }),
      db.loanAdjustment.create({
        data: { loanId: id, type: "WriteOff", amount: data.amount, reason: data.reason, requestedByUserId: session.user.id },
      }),
    ]);

    await postLedgerEntries([
      {
        accountCode: ACCOUNTS.LOAN_LOSS_PROVISION,
        description: `Write-off — ${id}`,
        debit: data.amount,
        branchId: loan.branchId,
        referenceType: "Loan",
        referenceId: id,
      },
      {
        accountCode: ACCOUNTS.LOANS_RECEIVABLE,
        description: `Write-off — ${id}`,
        credit: data.amount,
        branchId: loan.branchId,
        referenceType: "Loan",
        referenceId: id,
      },
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "loan.written_off",
      entityType: "Loan",
      entityId: id,
      newValue: { amount: data.amount, reason: data.reason, fullyWrittenOff },
      request: req,
    });
    await invalidateTag(tags.loans);
    await invalidateTag(tags.ledger);
    return NextResponse.json(adjustment, { status: 201 });
  }

  // InterestWaiver
  const schedule = generateAmortizationSchedule({
    principal: loan.principal,
    monthlyRatePercent: loan.interestRate,
    periodMonths: loan.repaymentPeriodMonths,
    method: loan.interestMethod,
    startDate: loan.disbursedAt,
  });
  const outstandingInterest = Math.max(schedule.totalInterest - repaidInterest - existingWaived, 0);
  if (data.amount > outstandingInterest) {
    return NextResponse.json(
      { error: `Cannot waive more than the outstanding interest (${outstandingInterest})` },
      { status: 400 }
    );
  }

  const adjustment = await db.loanAdjustment.create({
    data: { loanId: id, type: "InterestWaiver", amount: data.amount, reason: data.reason, requestedByUserId: session.user.id },
  });

  // No ledger entry: interest is recognized on a cash basis (only posted at
  // repayment time — see lib/ledger.ts's buildRepaymentLedgerLines), so
  // nothing was ever booked for this not-yet-collected interest in the
  // first place.
  await writeAuditLog({
    userId: session.user.id,
    action: "loan.interest_waived",
    entityType: "Loan",
    entityId: id,
    newValue: { amount: data.amount, reason: data.reason },
    request: req,
  });
  await invalidateTag(tags.loans);
  return NextResponse.json(adjustment, { status: 201 });
}
