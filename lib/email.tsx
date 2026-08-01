import { Resend } from "resend";
import { OTPTemplate } from "@/components/emails/otp-template";
import { ResetPasswordTemplate } from "@/components/emails/reset-password-template";

// Constructing `new Resend()` with no key throws synchronously — never do
// that at module scope, since importing this file (e.g. via lib/auth.ts)
// would crash the whole process before any request-time try/catch runs.
function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — email sending is unavailable.");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendVerificationEmail(email: string, otp: string) {
  try {
    console.log(`Attempting to send OTP email to ${email}...`);

    const { data, error } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject: "Your Verification Code",
      react: <OTPTemplate otp={otp} />,
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw error;
    }

    console.log(`Email sent successfully to ${email}. ID:`, data?.id);
    return data;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    if (error instanceof Error) {
      console.error("Error Message:", error.message);
    }
    throw error;
  }
}

export async function sendResetPasswordEmail(email: string, url: string) {
  try {
    console.log(`Attempting to send Reset Password email to ${email}...`);

    const { data, error } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject: "Reset your password",
      react: <ResetPasswordTemplate url={url} />,
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw error;
    }

    console.log(`Reset Password email sent successfully to ${email}. ID:`, data?.id);
    return data;
  } catch (error) {
    console.error("Failed to send reset password email:", error);
    if (error instanceof Error) {
      console.error("Error Message:", error.message);
    }
    throw error;
  }
}
