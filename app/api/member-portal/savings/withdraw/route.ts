import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { withdrawalConfirmSchema } from "@/lib/schemas/member-savings";
import { checkWithdrawalEligibility } from "@/lib/withdrawal-eligibility";
import { verifyWithdrawalOtp } from "@/lib/withdrawal-otp";
import { disburse, isDGatewayConfigured } from "@/lib/dgateway";
import { confirmSavingsWithdrawal } from "@/lib/payment-confirmation";
import { writeAuditLog } from "@/lib/audit";
import { invalidateTag, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Step 2 of the member self-service withdrawal flow: verifies the OTP from
 * /request-otp, re-checks eligibility (state may have moved since the code
 * was issued — another withdrawal, a new loan, etc.), then either:
 *  - requires staff approval first (large withdrawal, above the configured
 *    threshold) — records it as PendingApproval, no payout sent yet, or
 *  - sends the real RohoPay payout immediately, to the member's registered
 *    phone number.
 * Mirrors the loan-disbursement route's synchronous-status-then-webhook
 * discipline: never marks a withdrawal Confirmed optimistically.
 */
export async function POST(req: Request) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const body = await req.json();
  const parsed = withdrawalConfirmSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const otpResult = await verifyWithdrawalOtp(parsed.data.requestId, parsed.data.code, memberId);
  if (!otpResult.ok) return NextResponse.json({ error: otpResult.error }, { status: 400 });

  const { savingsAccountId, amount } = otpResult;

  const account = await db.savingsAccount.findUnique({
    where: { id: savingsAccountId },
    include: { member: { select: { firstName: true, lastName: true, email: true, phone: true, branchId: true, memberNumber: true } } },
  });
  if (!account) return NextResponse.json({ error: "Savings account not found" }, { status: 404 });
  if (account.memberId !== memberId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Re-check — the world may have moved since the OTP was issued minutes ago.
  const eligibility = await checkWithdrawalEligibility({ savingsAccountId, amount });
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 400 });
  }

  const branchId = account.member.branchId;
  const projectedBalance = account.balance - amount;

  if (eligibility.requiresApproval) {
    const transaction = await db.savingsTransaction.create({
      data: {
        savingsAccountId,
        type: "Withdrawal",
        amount,
        penaltyAmount: eligibility.penaltyAmount,
        balanceAfter: projectedBalance,
        branchId,
        status: "PendingApproval",
        method: "MobileMoney",
        phone: account.member.phone,
        channel: "MemberPortal",
        memberUserId: session.user.id,
      },
    });

    await writeAuditLog({
      userId: null,
      action: "savings_transaction.member_withdrawal_pending_approval",
      entityType: "SavingsTransaction",
      entityId: transaction.id,
      newValue: { savingsAccountId, amount, memberUserId: session.user.id },
      request: req,
    });

    await invalidateTag(tags.savings);
    return NextResponse.json({
      status: "pending_approval",
      message: "This withdrawal is above the automatic limit and needs staff approval before it's sent.",
      transaction,
    });
  }

  if (!isDGatewayConfigured()) {
    return NextResponse.json(
      { error: "Mobile Money withdrawals aren't available right now — please withdraw at your branch." },
      { status: 503 }
    );
  }

  const reference = `NGS-SWDR-${account.id}-${Date.now()}`;
  try {
    const result = await disburse({
      phone: account.member.phone,
      amountUgx: eligibility.netPayoutAmount,
      reference,
      narration: `Nexcgen savings withdrawal — ${account.member.memberNumber}`,
    });

    const transaction = await db.savingsTransaction.create({
      data: {
        savingsAccountId,
        type: "Withdrawal",
        amount,
        penaltyAmount: eligibility.penaltyAmount,
        balanceAfter: projectedBalance,
        branchId,
        status: "Pending",
        method: "MobileMoney",
        transactionId: result.transactionRef,
        phone: account.member.phone,
        channel: "MemberPortal",
        memberUserId: session.user.id,
      },
    });

    await writeAuditLog({
      userId: null,
      action: "savings_transaction.member_withdrawal_initiated",
      entityType: "SavingsTransaction",
      entityId: transaction.id,
      newValue: { savingsAccountId, amount, memberUserId: session.user.id, transactionRef: result.transactionRef },
      request: req,
    });

    await invalidateTag(tags.savings);

    if (result.status === "successful") {
      const confirmResult = await confirmSavingsWithdrawal(result.transactionRef, req);
      if (confirmResult.ok) {
        return NextResponse.json({
          status: "confirmed",
          message: "Withdrawal successful — funds have been sent to your Mobile Money.",
          transaction,
        });
      }
    }

    return NextResponse.json({
      status: "pending",
      message: "Withdrawal initiated — your balance will update once RohoPay confirms the payout.",
      transaction,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Mobile Money withdrawal failed" },
      { status: 502 }
    );
  }
}
