import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { memberRepaymentSchema } from "@/lib/schemas/member-loan";
import { generateAmortizationSchedule, computeOutstandingBreakdown, splitRepayment } from "@/lib/loan-calculator";
import { collectPayment, isDGatewayConfigured } from "@/lib/dgateway";
import { writeAuditLog } from "@/lib/audit";
import { invalidateTag, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Member self-service loan repayment — Mobile Money only, same
 * pending-until-webhook-confirms discipline as the staff MobileMoney path
 * (app/api/repayments/route.ts). Nothing here moves the loan balance
 * directly; app/api/dgateway/webhook/route.ts does that once DGateway
 * confirms the collection actually succeeded.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  if (!isDGatewayConfigured()) {
    return NextResponse.json(
      { error: "Mobile Money repayment isn't available right now — please pay at your branch." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const parsed = memberRepaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { amount, phone } = parsed.data;

  const { id } = await params;
  const loan = await db.loan.findUnique({
    where: { id },
    include: {
      loanApplication: { include: { loanProduct: true } },
      repayments: { where: { status: "Confirmed" } },
      member: { select: { memberNumber: true } },
    },
  });
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  if (loan.memberId !== memberId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const schedule = generateAmortizationSchedule({
    principal: loan.principal,
    monthlyRatePercent: loan.interestRate,
    periodMonths: loan.repaymentPeriodMonths,
    method: loan.interestMethod,
    startDate: loan.disbursedAt,
  });
  const outstanding = computeOutstandingBreakdown(schedule, loan.repayments, loan.loanApplication.loanProduct.penaltyRate);
  const payable = {
    principalDue: outstanding.principalPayable,
    interestDue: outstanding.interestPayable,
    penaltyDue: outstanding.penaltyDue,
  };
  const totalOwed = payable.principalDue + payable.interestDue + payable.penaltyDue;
  if (totalOwed <= 0) {
    return NextResponse.json({ error: "This loan is already fully repaid" }, { status: 400 });
  }
  if (amount > totalOwed) {
    return NextResponse.json(
      { error: `Amount exceeds the loan's total outstanding balance of UGX ${totalOwed.toLocaleString()}` },
      { status: 400 }
    );
  }

  const { principalPortion, interestPortion, penaltyPortion } = splitRepayment(amount, payable);
  const receiptNumber = `RCT-${loan.branchId.slice(-4).toUpperCase()}-${Date.now()}`;
  const reference = `NGS-MRPY-${loan.id}-${Date.now()}`;

  try {
    const result = await collectPayment({
      phone,
      amountUgx: amount,
      reference,
      narration: `Nexcgen loan repayment — ${loan.member.memberNumber}`,
    });

    const repayment = await db.repayment.create({
      data: {
        loanId: loan.id,
        amountPaid: amount,
        principalPortion,
        interestPortion,
        penaltyPortion,
        method: "MobileMoney",
        status: "Pending",
        receiptNumber,
        transactionId: result.transactionRef,
        channel: "MemberPortal",
        memberUserId: session.user.id,
        branchId: loan.branchId,
      },
    });

    await writeAuditLog({
      userId: null,
      action: "repayment.member_initiated",
      entityType: "Repayment",
      entityId: repayment.id,
      newValue: { loanId: loan.id, amount, memberUserId: session.user.id, transactionRef: result.transactionRef },
      request: req,
    });

    await invalidateTag(tags.repayments);
    await invalidateTag(tags.loans);

    return NextResponse.json({
      status: "pending",
      message: "Mobile Money collection initiated — your balance will update once confirmed.",
      repayment,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mobile Money collection failed" },
      { status: 502 }
    );
  }
}
