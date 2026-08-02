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
// Endpoints reachable by BOTH staff and member-portal sessions — the route
// handler itself does the real authorization (e.g. a member can only
// reconcile/view their OWN records), this just needs to let either cookie
// type past the proxy instead of assuming staff-only and redirecting a
// legitimately-signed-in member to the staff sign-in page.
//  - /api/r2/upload, /api/local-upload: staff loan wizard/KYC uploads AND
//    member-portal loan application document/selfie uploads.
//  - /api/savings-transactions: staff-side deposit confirm (staff-only,
//    enforced in-route) AND member self-service Mobile Money reconcile
//    (member-scoped to their own transaction, enforced in-route).
const DUAL_AUTH_PREFIXES = ["/api/r2/upload", "/api/local-upload", "/api/savings-transactions"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (API_AUTH_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (SYSTEM_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (ASSET_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  if (DUAL_AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
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
