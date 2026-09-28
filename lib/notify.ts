import "server-only";
import { Resend } from "resend";
import { sendSms } from "@/lib/notifications";
import { formatUGX } from "@/lib/utils";
import { DueDateReminderEmail } from "@/components/emails/due-date-reminder-email";
import { ApprovalStatusEmail } from "@/components/emails/approval-status-email";
import { DisbursementConfirmationEmail } from "@/components/emails/disbursement-confirmation-email";
import { PenaltyAlertEmail } from "@/components/emails/penalty-alert-email";
import { MembershipExpiryEmail } from "@/components/emails/membership-expiry-email";
import { MaintenanceFeeEmail } from "@/components/emails/maintenance-fee-email";
import type { ReactElement } from "react";

async function sendEmail(to: string, subject: string, react: ReactElement) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[notify] RESEND_API_KEY not set — would have emailed ${to}: ${subject}`);
    return;
  }
  try {
    // Constructed lazily, only once the key is known to be present — the
    // Resend SDK throws in its own constructor on a missing/empty key, so a
    // module-scope `new Resend(...)` (as this used to be) crashes Next's
    // build entirely for every route that transitively imports this file,
    // not just this function, the moment RESEND_API_KEY is unset anywhere
    // (a staging/preview deploy with no email configured, or the key
    // expiring in production) — turning a soft "email disabled" dependency
    // into a hard "the whole app won't build" one.
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to,
      subject,
      react,
    });
  } catch (e) {
    console.error("[notify] email dispatch failed:", e);
  }
}

type Recipient = { name: string; email?: string | null; phone: string };

export async function notifyDueDateReminder(to: Recipient, amountDue: number, dueDate: Date) {
  const amount = formatUGX(amountDue);
  const date = dueDate.toLocaleDateString("en-UG");
  await Promise.all([
    to.email
      ? sendEmail(to.email, "Upcoming loan repayment", DueDateReminderEmail({ memberName: to.name, amountDue: amount, dueDate: date }))
      : Promise.resolve(),
    sendSms(to.phone, `Nexcgen: Your instalment of ${amount} is due ${date}. Please pay on time.`),
  ]);
}

export async function notifyApprovalStatus(
  to: Recipient,
  amount: number,
  status: "Approved" | "Rejected" | "Returned",
  comments?: string
) {
  const amountStr = formatUGX(amount);
  await Promise.all([
    to.email
      ? sendEmail(to.email, `Loan application ${status.toLowerCase()}`, ApprovalStatusEmail({ memberName: to.name, amount: amountStr, status, comments }))
      : Promise.resolve(),
    sendSms(to.phone, `Nexcgen: Your loan application for ${amountStr} was ${status.toLowerCase()}.`),
  ]);
}

export async function notifyDisbursement(to: Recipient, amount: number, method: string) {
  const amountStr = formatUGX(amount);
  await Promise.all([
    to.email
      ? sendEmail(to.email, "Loan disbursed", DisbursementConfirmationEmail({ memberName: to.name, amount: amountStr, method }))
      : Promise.resolve(),
    sendSms(to.phone, `Nexcgen: ${amountStr} has been disbursed to you via ${method}. Thank you.`),
  ]);
}

export async function notifyWithdrawal(to: Recipient, amount: number, penaltyAmount: number) {
  const amountStr = formatUGX(amount);
  const note = penaltyAmount > 0 ? ` (includes a ${formatUGX(penaltyAmount)} early-withdrawal fee)` : "";
  await Promise.all([
    to.email
      ? sendEmail(to.email, "Withdrawal confirmed", DisbursementConfirmationEmail({ memberName: to.name, amount: amountStr, method: "Mobile Money" }))
      : Promise.resolve(),
    sendSms(to.phone, `Nexcgen: Your withdrawal of ${amountStr}${note} has been sent to your Mobile Money. Thank you.`),
  ]);
}

export async function notifyMaintenanceFee(to: Recipient, amount: number, newBalance: number) {
  const amountStr = formatUGX(amount);
  const balanceStr = formatUGX(newBalance);
  await Promise.all([
    to.email
      ? sendEmail(
          to.email,
          "Account maintenance fee charged",
          MaintenanceFeeEmail({ memberName: to.name, amount: amountStr, newBalance: balanceStr })
        )
      : Promise.resolve(),
    sendSms(to.phone, `Nexcgen: A monthly account maintenance fee of ${amountStr} was deducted. New balance: ${balanceStr}.`),
  ]);
}

export async function notifyPenalty(to: Recipient, daysOverdue: number, penaltyDue: number) {
  const penaltyStr = formatUGX(penaltyDue);
  await Promise.all([
    to.email
      ? sendEmail(to.email, "Your loan is overdue", PenaltyAlertEmail({ memberName: to.name, daysOverdue, penaltyDue: penaltyStr }))
      : Promise.resolve(),
    sendSms(to.phone, `Nexcgen: Your loan is ${daysOverdue} days overdue. Penalty accrued: ${penaltyStr}. Please pay now.`),
  ]);
}

export async function notifyStaffEscalation(to: Recipient, memberName: string, daysOverdue: number, penaltyDue: number) {
  const penaltyStr = formatUGX(penaltyDue);
  await Promise.all([
    to.email
      ? sendEmail(
          to.email,
          `Default alert — ${memberName}`,
          PenaltyAlertEmail({ memberName: `${memberName} (assigned to you)`, daysOverdue, penaltyDue: penaltyStr })
        )
      : Promise.resolve(),
    sendSms(to.phone, `Nexcgen: Loan for ${memberName} has defaulted (${daysOverdue}d overdue, ${penaltyStr} penalty). Case assigned to you.`),
  ]);
}

export async function notifyMembershipExpiry(to: Recipient, expiryDate: Date) {
  const date = expiryDate.toLocaleDateString("en-UG");
  await Promise.all([
    to.email
      ? sendEmail(to.email, "Membership renewal due", MembershipExpiryEmail({ memberName: to.name, expiryDate: date }))
      : Promise.resolve(),
    sendSms(to.phone, `Nexcgen: Your membership is due for renewal on ${date}. Please visit your branch.`),
  ]);
}
