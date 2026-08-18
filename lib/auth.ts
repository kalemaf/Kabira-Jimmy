import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { emailOTP } from "better-auth/plugins";
import { sendVerificationEmail, sendResetPasswordEmail } from "./email";
import { authRedisStorage } from "./auth-redis-storage";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  secondaryStorage: authRedisStorage,
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
  },
  // Without this, every requireSession()/requireRole() call — i.e. every
  // protected page load and API request — round-trips to Redis just to
  // re-fetch session data that hasn't changed. cookieCache verifies a
  // short-lived signed cookie locally instead, only falling back to Redis
  // once the cache window expires (or on logout, which busts the cookie).
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Explicit, not left to the library default — staff accounts can
    // approve loans and disburse money, so a weak-password floor matters.
    minPasswordLength: 10,
    maxPasswordLength: 128,
    async sendResetPassword(data) {
      try {
        await sendResetPasswordEmail(data.user.email, data.url);
      } catch (error) {
        console.error("Error sending reset password email:", error);
      }
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "LoanOfficer",
        input: false,
      },
      branchId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        try {
          await sendVerificationEmail(email, otp);
        } catch (e) {
          console.error("Error in sendVerificationOTP plugin wrapper:", e);
          // Fallback logging for development
          console.log(`[DEV FALLBACK] OTP for ${email}: ${otp}`);
        }
      },
    }),
  ],
});
