import type { Instrumentation } from "next";

/**
 * Baseline error visibility — no third-party error tracking service is wired
 * up yet (no Sentry/Bugsnag account exists for this project), so this is the
 * cheapest thing that actually helps: every uncaught server-side error gets
 * a structured console.error, which Vercel's Runtime Logs / Observability
 * tab already captures with zero extra setup or third-party account needed.
 * For the specific failures that need a human to act fast (a Mobile Money
 * payout that didn't go out, a webhook RohoPay couldn't be matched to any
 * transaction), see lib/alert.ts — this hook is a safety net underneath
 * that, not a replacement for it.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  console.error("[onRequestError]", {
    path: request.path,
    method: request.method,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  });
};
