import type { NextConfig } from "next"

// Production security headers — a financial admin app has no business being
// framed by another site, sniffed for MIME type, or leaking full referrer
// URLs cross-origin. CSP intentionally stays permissive on script-src
// (Next.js injects inline hydration data) rather than risk a nonce-based
// setup breaking the app without the infrastructure to test it thoroughly;
// object-src/frame-ancestors are the two director restrictions with the
// most safety payoff.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // static.cloudflareinsights.com: Cloudflare auto-injects its own
      // analytics beacon script on domains proxied through it (the custom
      // domain routes through Cloudflare) — not something this app adds
      // itself, but it needs an explicit allowlist entry or the CSP blocks it.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // ws:/wss: needed for Turbopack's dev-mode HMR socket — harmless in
      // production since there's no HMR connection to make there.
      "connect-src 'self' https: ws: wss:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
