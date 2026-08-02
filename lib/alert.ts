import "server-only";
import { db } from "@/lib/db";
import { Resend } from "resend";

/**
 * Alerts a human when money-handling code hits a failure state that needs
 * attention faster than "someone eventually notices in the audit log" —
 * specifically: a Mobile Money payout that didn't go out when it should
 * have, and a RohoPay webhook with a valid signature that couldn't be
 * matched to any known transaction (either a bug in our reference matching,
 * or a transaction we have no record of).
 *
 * Deliberately reuses the existing Resend setup rather than adding a new
 * third-party monitoring service/account (Sentry etc.) that nobody has
 * signed up for yet — every SuperAdmin gets a plain email. This never
 * throws: alerting must not itself take down the code path it's protecting.
 */
export async function sendCriticalAlert(subject: string, details: Record<string, unknown>): Promise<void> {
  console.error(`[CRITICAL ALERT] ${subject}`, details);

  if (!process.env.RESEND_API_KEY) return;

  try {
    const superAdmins = await db.user.findMany({
      where: { role: "SuperAdmin" },
      select: { email: true },
    });
    if (superAdmins.length === 0) return;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const detailLines = Object.entries(details)
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join("\n");

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: superAdmins.map((s) => s.email),
      subject: `[Nexcgen alert] ${subject}`,
      text: `${subject}\n\n${detailLines}\n\nTime: ${new Date().toISOString()}`,
    });
  } catch (e) {
    console.error("[sendCriticalAlert] failed to send alert email:", e);
  }
}
