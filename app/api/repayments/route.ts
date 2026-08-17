import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { createRepaymentSchema } from "@/lib/schemas/repayment";
import { generateAmortizationSchedule, computeOutstandingBreakdown, splitRepayment } from "@/lib/loan-calculator";
import { collectPayment as dgatewayCollect } from "@/lib/dgateway";
import { confirmRepayment } from "@/lib/payment-confirmation";
import { getMobileMoneyRepaymentFeePercent } from "@/lib/repayment-fee-policy";
import { formatUGX } from "@/lib/utils";
import { postLedgerEntries, buildRepaymentLedgerLines, ACCOUNTS } from "@/lib/ledger";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const loanId = searchParams.get("loanId")?.trim() ?? "";
  const cacheKey = `tag:${tags.repayments}:${page}:${limit}:${loanId}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where = loanId ? { loanId } : {};
      const [data, total] = await Promise.all([
        db.repayment.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { paidAt: "desc" },
          include: {
            loan: { include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } } },
            collector: { select: { name: true } },
          },
        }),
        db.repayment.count({ where }),
      ]);
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    20
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "Cashier", "LoanOfficer"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createRepaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { loanId, amountPaid, method, phone, transactionId } = parsed.data;

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: {
      loanApplication: { include: { loanProduct: true } },
      repayments: { where: { status: "Confirmed" } },
      member: { select: { firstName: true, lastName: true, memberNumber: true, phone: true } },
    },
  });
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

  const schedule = generateAmortizationSchedule({
    principal: loan.principal,
    monthlyRatePercent: loan.interestRate,
    periodMonths: loan.repaymentPeriodMonths,
    method: loan.interestMethod,
    startDate: loan.disbursedAt,
  });

  const outstanding = computeOutstandingBreakdown(
    schedule,
    loan.repayments,
    loan.loanApplication.loanProduct.penaltyRate
  );

  // Allocate against the FULL remaining schedule (principalPayable/interestPayable),
  // not just the strictly-overdue portion — a member paying on or before their due
  // date is the normal case, and outstanding.principalDue/interestDue only cover
  // installments already past due.
  const payable = {
    principalDue: outstanding.principalPayable,
    interestDue: outstanding.interestPayable,
    penaltyDue: outstanding.penaltyDue,
  };
  const totalOwed = payable.principalDue + payable.interestDue + payable.penaltyDue;
  if (amountPaid > totalOwed) {
    return NextResponse.json(
      { error: `Amount exceeds the loan's total outstanding balance of UGX ${totalOwed.toLocaleString()}` },
      { status: 400 }
    );
  }

  const { principalPortion, interestPortion, penaltyPortion } = splitRepayment(amountPaid, payable);
  const receiptNumber = `RCT-${loan.branchId.slice(-4).toUpperCase()}-${Date.now()}`;

  if (method === "MobileMoney") {
    // Staff-collected Mobile Money repayments charge the member a fee on
    // top of what they actually owe (see lib/repayment-fee-policy.ts) —
    // the RohoPay prompt the member approves shows amountPaid + fee, but
    // only amountPaid is ever applied toward the loan; the fee is retained
    // as SACCO fee income (posted separately once confirmed — see
    // lib/payment-confirmation.ts's confirmRepayment).
    const feePercent = await getMobileMoneyRepaymentFeePercent();
    const collectionFeeAmount = Math.round(amountPaid * (feePercent / 100));
    const amountToCharge = amountPaid + collectionFeeAmount;

    const reference = transactionId || `NGS-RPY-${loanId}-${Date.now()}`;
    try {
      const result = await dgatewayCollect({
        phone: phone!,
        amountUgx: amountToCharge,
        reference,
        narration: `Nexcgen loan repayment — ${loan.member.memberNumber}`,
      });

      const repayment = await db.repayment.create({
        data: {
          loanId,
          amountPaid,
          principalPortion,
          interestPortion,
          penaltyPortion,
          collectionFeeAmount,
          method,
          status: "Pending",
          receiptNumber,
          transactionId: result.transactionRef,
          collectorId: session.user.id,
          branchId: loan.branchId,
        },
        include: { collector: { select: { name: true } } },
      });

      await writeAuditLog({
        userId: session.user.id,
        action: "repayment.initiated",
        entityType: "Repayment",
        entityId: repayment.id,
        newValue: { loanId, amountPaid, collectionFeeAmount, amountCharged: amountToCharge, method, transactionRef: result.transactionRef },
        request: req,
      });

      // RohoPay's collect call can already report the final outcome
      // synchronously (see lib/dgateway.ts) rather than only via a later
      // webhook — confirm right away when it does.
      if (result.status === "successful") {
        await confirmRepayment(result.transactionRef, req);
        return NextResponse.json({
          status: "confirmed",
          message: `Mobile Money collection successful — UGX ${amountToCharge.toLocaleString()} charged (${formatUGX(amountPaid)} repayment + ${formatUGX(collectionFeeAmount)} Mobile Money fee). The balance has been updated.`,
          repayment,
          amountCharged: amountToCharge,
          collectionFeeAmount,
        });
      }

      return NextResponse.json({
        status: "pending",
        message: `Mobile Money collection initiated for UGX ${amountToCharge.toLocaleString()} (${formatUGX(amountPaid)} repayment + ${formatUGX(collectionFeeAmount)} fee) — the balance will update once confirmed.`,
        repayment,
        amountCharged: amountToCharge,
        collectionFeeAmount,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Mobile Money collection failed" },
        { status: 502 }
      );
    }
  }

  const repayment = await db.repayment.create({
    data: {
      loanId,
      amountPaid,
      principalPortion,
      interestPortion,
      penaltyPortion,
      method,
      status: "Confirmed",
      receiptNumber,
      transactionId: transactionId || null,
      collectorId: session.user.id,
      branchId: loan.branchId,
    },
    include: { collector: { select: { name: true } } },
  });

  const totalRepaidPrincipal =
    loan.repayments.reduce((sum, r) => sum + r.principalPortion, 0) + principalPortion;
  if (totalRepaidPrincipal >= loan.principal) {
    await db.loan.update({ where: { id: loanId }, data: { status: "PaidOff" } });
  }

  await postLedgerEntries(
    buildRepaymentLedgerLines(repayment, method === "Cash" ? ACCOUNTS.CASH : ACCOUNTS.BANK)
  );

  await writeAuditLog({
    userId: session.user.id,
    action: "repayment.collected",
    entityType: "Repayment",
    entityId: repayment.id,
    newValue: { loanId, amountPaid, method, principalPortion, interestPortion, penaltyPortion },
    request: req,
  });

  await invalidateTag(tags.repayments);
  await invalidateTag(tags.loans);
  const outstandingBalance = Math.max(loan.principal - totalRepaidPrincipal, 0);
  return NextResponse.json({ status: "confirmed", repayment, outstandingBalance }, { status: 201 });
}
