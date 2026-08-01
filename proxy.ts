import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Staff auth uses Better Auth's default cookie prefix; member auth uses its
// own (lib/member-auth.ts advanced.cookiePrefix) so the two sessions never
// collide in the same browser.
const MEMBER_COOKIE_PREFIX = "sacco-member";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/member-portal/login",
  "/member-portal/auth/sign-in",
  "/member-portal/auth/sign-up",
  "/member-portal/auth/forgot-password",
  "/member-portal/auth/reset-password",
  "/member-portal/auth/verify-email",
];

const API_AUTH_PREFIXES = ["/api/auth", "/api/member-auth"];
const ASSET_PREFIXES = ["/_next", "/favicon", "/images", "/illustrations"];
// Server-to-server callbacks (Vercel Cron, DGateway webhooks) can never
// carry a browser session cookie — they authenticate themselves (CRON_SECRET
// bearer token, webhook payload) inside the route handler instead.
const SYSTEM_PREFIXES = ["/api/cron", "/api/dgateway/webhook"];
// Object-storage upload endpoints are called by BOTH staff-side flows (loan
// wizard, staff KYC) and member-portal self-service flows (loan application
// documents/selfie) — accept either cookie type rather than assuming staff.
const SHARED_UPLOAD_PREFIXES = ["/api/r2/upload", "/api/local-upload"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (API_AUTH_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (SYSTEM_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (ASSET_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  if (SHARED_UPLOAD_PREFIXES.some((p) => pathname.startsWith(p))) {
    const hasStaffCookie = getSessionCookie(req);
    const hasMemberCookie = getSessionCookie(req, { cookiePrefix: MEMBER_COOKIE_PREFIX });
    if (!hasStaffCookie && !hasMemberCookie) {
      const signInUrl = new URL("/auth/sign-in", req.url);
      signInUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  const isMemberRoute = pathname.startsWith("/member-portal") || pathname.startsWith("/api/member-portal");

  const sessionCookie = isMemberRoute
    ? getSessionCookie(req, { cookiePrefix: MEMBER_COOKIE_PREFIX })
    : getSessionCookie(req);

  if (!sessionCookie) {
    const signInPath = isMemberRoute ? "/member-portal/auth/sign-in" : "/auth/sign-in";
    const signInUrl = new URL(signInPath, req.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
