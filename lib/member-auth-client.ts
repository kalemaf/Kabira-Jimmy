import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const memberAuthClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/member-auth",
  plugins: [emailOTPClient()],
});
