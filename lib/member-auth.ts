import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { emailOTP } from "better-auth/plugins";
import { sendVerificationEmail, sendResetPasswordEmail } from "./email";
import { authRedisStorage } from "./auth-redis-storage";

// Separate Better Auth instance for the member self-service portal. Distinct
// basePath + cookiePrefix + Prisma models keep member sessions from ever
// colliding with staff sessions (lib/auth.ts) on the same device/browser.
export const memberAuth = betterAuth({
  basePath: "/api/member-auth",
  advanced: {
    cookiePrefix: "sacco-member",
  },
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  secondaryStorage: authRedisStorage,
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword(data) {
      try {
        await sendResetPasswordEmail(data.user.email, data.url);
      } catch (error) {
        console.error("Error sending member reset password email:", error);
      }
    },
  },
  user: {
    modelName: "memberUser",
    additionalFields: {
      memberId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  session: {
    modelName: "memberSession",
    // See lib/auth.ts for why this matters — avoids a Redis round-trip on
    // every member-portal request for session data that hasn't changed.
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  account: {
    modelName: "memberAccount",
  },
  verification: {
    modelName: "memberVerification",
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        try {
          await sendVerificationEmail(email, otp);
        } catch (e) {
          console.error("Error sending member OTP email:", e);
          console.log(`[DEV FALLBACK] Member OTP for ${email}: ${otp}`);
        }
      },
    }),
  ],
});
