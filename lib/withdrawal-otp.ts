import "server-only";
import { redis } from "@/lib/cache";
import { randomInt, randomUUID } from "crypto";
import { Resend } from "resend";
import { formatUGX } from "@/lib/utils";

const OTP_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;

type WithdrawalOtpRecord = {
  code: string;
  memberId: string;
  savingsAccountId: string;
  amount: number;
  attempts: number;
};

function otpKey(requestId: string) {
  return `withdrawal-otp:${requestId}`;
}

/**
 * Generates and emails a 6-digit OTP tied to a specific withdrawal request
 * (member, account, amount) — deliberately separate from Better Auth's
 * emailOTP plugin, which confirms identity at sign-in, not a specific money
 * transaction. The opaque requestId (not the amount/account) is what the
 * confirm step trusts, so a member can't request an OTP for a small amount
 * and reuse it to confirm a larger one.
 */
export async function createWithdrawalOtp(params: {
  memberId: string;
  savingsAccountId: string;
  amount: number;
  email: string;
  memberName: string;
}): Promise<{ requestId: string }> {
  const requestId = randomUUID();
  const code = String(randomInt(100000, 1000000));

  const record: WithdrawalOtpRecord = {
    code,
    memberId: params.memberId,
    savingsAccountId: params.savingsAccountId,
    amount: params.amount,
    attempts: 0,
  };
  await redis.set(otpKey(requestId), record, { ex: OTP_TTL_SECONDS });

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: params.email,
        subject: "Confirm your withdrawal",
        text: `Hi ${params.memberName},\n\nYour confirmation code to withdraw ${formatUGX(params.amount)} is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email and contact your branch.`,
      });
    } catch (e) {
      console.error("[withdrawal-otp] failed to send OTP email:", e);
      throw new Error("Could not send the confirmation code — try again shortly");
    }
  } else {
    console.warn(`[withdrawal-otp] RESEND_API_KEY not set — OTP for ${params.email}: ${code}`);
  }

  return { requestId };
}

export type VerifyOtpResult =
  | { ok: true; savingsAccountId: string; amount: number }
  | { ok: false; error: string };

export async function verifyWithdrawalOtp(
  requestId: string,
  code: string,
  memberId: string
): Promise<VerifyOtpResult> {
  const record = await redis.get<WithdrawalOtpRecord>(otpKey(requestId));
  if (!record) return { ok: false, error: "This confirmation code has expired — start the withdrawal again." };
  if (record.memberId !== memberId) return { ok: false, error: "This confirmation code doesn't belong to you." };

  if (record.attempts >= MAX_ATTEMPTS) {
    await redis.del(otpKey(requestId));
    return { ok: false, error: "Too many incorrect attempts — start the withdrawal again." };
  }

  if (record.code !== code) {
    await redis.set(otpKey(requestId), { ...record, attempts: record.attempts + 1 }, { ex: OTP_TTL_SECONDS });
    return { ok: false, error: "Incorrect code — check your email and try again." };
  }

  await redis.del(otpKey(requestId));
  return { ok: true, savingsAccountId: record.savingsAccountId, amount: record.amount };
}
