import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { withdrawalOtpRequestSchema } from "@/lib/schemas/member-savings";
import { checkWithdrawalEligibility } from "@/lib/withdrawal-eligibility";
import { createWithdrawalOtp } from "@/lib/withdrawal-otp";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Step 1 of the member self-service withdrawal flow: validates eligibility
 * (dry run — no state changes yet) and, if eligible, emails a one-time
 * confirmation code. Nothing about the member's balance or any RohoPay
 * payout happens here; that only occurs once they confirm the code at
 * POST /api/member-portal/savings/withdraw.
 */
export async function POST(req: Request) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const body = await req.json();
  const parsed = withdrawalOtpRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { savingsAccountId, amount } = parsed.data;

  const account = await db.savingsAccount.findUnique({
    where: { id: savingsAccountId },
    include: { member: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } } },
  });
  if (!account) return NextResponse.json({ error: "Savings account not found" }, { status: 404 });
  if (account.memberId !== memberId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!account.member.email) {
    return NextResponse.json(
      { error: "Your account has no email on file — visit your branch to add one before withdrawing online." },
      { status: 400 }
    );
  }

  const eligibility = await checkWithdrawalEligibility({ savingsAccountId, amount });
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 400 });
  }

  const { requestId } = await createWithdrawalOtp({
    memberId,
    savingsAccountId,
    amount,
    email: account.member.email,
    memberName: `${account.member.firstName} ${account.member.lastName}`,
  });

  return NextResponse.json({
    requestId,
    maskedEmail: account.member.email.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
    maskedPhone: account.member.phone.replace(/^(\+256\d{3}).*(\d{2})$/, "$1***$2"),
    requiresApproval: eligibility.requiresApproval,
    penaltyAmount: eligibility.penaltyAmount,
    netPayoutAmount: eligibility.netPayoutAmount,
  });
}
