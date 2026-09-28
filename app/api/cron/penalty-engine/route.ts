import { db } from "@/lib/db";
import { generateAmortizationSchedule, computeOutstandingBreakdown } from "@/lib/loan-calculator";
import { writeAuditLog } from "@/lib/audit";
import { invalidateTag, tags } from "@/lib/cache";
import { notifyDueDateReminder, notifyPenalty, notifyStaffEscalation } from "@/lib/notify";
import { runMonthlyAccountMaintenanceFee } from "@/lib/account-maintenance-fee";
import { NextResponse } from "next/server";

const DEFAULT_AFTER_DAYS = 90;
const REMINDER_DAYS_BEFORE_DUE = 3;

/** Assigns the Recovery Officer with the fewest open (non-Recovered) cases. */
async function pickRecoveryOfficer(): Promise<string | null> {
  const officers = await db.user.findMany({ where: { role: "RecoveryOfficer" }, select: { id: true } });
  if (officers.length === 0) return null;

  const caseCounts = await db.recoveryCase.groupBy({
    by: ["recoveryOfficerId"],
    where: { recoveryOfficerId: { in: officers.map((o) => o.id) }, status: { not: "Recovered" } },
    _count: true,
  });
  const countByOfficer = new Map(caseCounts.map((c) => [c.recoveryOfficerId, c._count]));

  let best = officers[0].id;
  let bestCount = countByOfficer.get(best) ?? 0;
  for (const officer of officers) {
    const count = countByOfficer.get(officer.id) ?? 0;
    if (count < bestCount) {
      best = officer.id;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Daily penalty engine (Vercel Cron — see vercel.json). Flags loans whose
 * next unpaid instalment is past due as Overdue, escalates long-overdue
 * loans to Defaulted (auto-opening a RecoveryCase assigned to the
 * least-loaded Recovery Officer), computes the current penalty owed, and
 * dispatches SMS/Email reminders — a due-date nudge 3 days before an
 * instalment is due, a penalty alert the day a loan is newly flagged
 * Overdue, and a staff escalation (Manager + assigned Recovery Officer) the
 * day a loan defaults. Each fires once per transition, not daily, to avoid
 * spamming the member/staff on every run.
 */
export async function GET(req: Request) {
  // Fail CLOSED: an unset CRON_SECRET must never leave this endpoint open.
  // A misconfigured deployment should reject every request, not silently
  // skip the check — this endpoint can flag loans defaulted and dispatch
  // member/staff notifications, so it must never be publicly callable.
  if (!process.env.CRON_SECRET) {
    console.error("[cron/penalty-engine] CRON_SECRET is not set — refusing all requests");
    return NextResponse.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeLoans = await db.loan.findMany({
    where: { status: { in: ["Active", "Overdue"] } },
    include: {
      loanApplication: { include: { loanProduct: true } },
      repayments: { where: { status: "Confirmed" } },
      member: { select: { firstName: true, lastName: true, email: true, phone: true } },
      branch: { select: { id: true } },
    },
  });

  let flaggedOverdue = 0;
  let flaggedDefaulted = 0;
  let notificationsQueued = 0;
  const now = new Date();

  for (const loan of activeLoans) {
    const schedule = generateAmortizationSchedule({
      principal: loan.principal,
      monthlyRatePercent: loan.interestRate,
      periodMonths: loan.repaymentPeriodMonths,
      method: loan.interestMethod,
      startDate: loan.disbursedAt,
    });

    const outstanding = computeOutstandingBreakdown(
      schedule,
      loan.repayments,
      loan.loanApplication.loanProduct.penaltyRate,
      now
    );

    const overdueRow = schedule.rows.find((row) => new Date(row.dueDate) < now);
    const isCurrentlyOverdue = !!overdueRow && outstanding.totalDue > 0;
    const recipient = {
      name: `${loan.member.firstName} ${loan.member.lastName}`,
      email: loan.member.email,
      phone: loan.member.phone,
    };

    // Caught back up — revert an Overdue loan to Active rather than leaving
    // it stuck once the member repays what was owed. Defaulted is a
    // one-way escalation (handled by Recovery, not auto-reverted here).
    if (!isCurrentlyOverdue) {
      if (loan.status === "Overdue") {
        await db.loan.update({ where: { id: loan.id }, data: { status: "Active" } });
        await writeAuditLog({
          userId: null,
          action: "loan.overdue_cleared",
          entityType: "Loan",
          entityId: loan.id,
          oldValue: { status: "Overdue" },
          newValue: { status: "Active" },
        });
      } else {
        // Not overdue — check for an upcoming due date worth a reminder.
        const nextRow = schedule.rows.find((row) => new Date(row.dueDate) >= now);
        if (nextRow) {
          const daysUntilDue = Math.round((new Date(nextRow.dueDate).getTime() - now.getTime()) / 86_400_000);
          if (daysUntilDue === REMINDER_DAYS_BEFORE_DUE) {
            await notifyDueDateReminder(recipient, nextRow.installment, new Date(nextRow.dueDate));
            notificationsQueued++;
          }
        }
      }
      continue;
    }

    const daysOverdue = Math.floor((now.getTime() - new Date(overdueRow.dueDate).getTime()) / 86_400_000);
    const shouldDefault = daysOverdue >= DEFAULT_AFTER_DAYS;
    const nextStatus = shouldDefault ? "Defaulted" : "Overdue";

    if (loan.status !== nextStatus) {
      await db.loan.update({ where: { id: loan.id }, data: { status: nextStatus } });
      await writeAuditLog({
        userId: null,
        action: shouldDefault ? "loan.defaulted" : "loan.flagged_overdue",
        entityType: "Loan",
        entityId: loan.id,
        oldValue: { status: loan.status },
        newValue: { status: nextStatus, daysOverdue, penaltyDue: outstanding.penaltyDue },
      });
      if (shouldDefault) flaggedDefaulted++;
      else flaggedOverdue++;

      if (!shouldDefault) {
        await notifyPenalty(recipient, daysOverdue, outstanding.penaltyDue);
        notificationsQueued++;
      }

      if (shouldDefault) {
        const existingCase = await db.recoveryCase.findUnique({ where: { loanId: loan.id } });
        if (!existingCase) {
          const recoveryOfficerId = await pickRecoveryOfficer();
          const recoveryCase = await db.recoveryCase.create({
            data: { loanId: loan.id, recoveryOfficerId, status: "Active" },
          });
          await writeAuditLog({
            userId: null,
            action: "recovery_case.auto_created",
            entityType: "RecoveryCase",
            entityId: recoveryCase.id,
            newValue: { loanId: loan.id, recoveryOfficerId, trigger: "loan.defaulted" },
          });
          await invalidateTag(tags.recovery);

          const escalationTargets = await db.user.findMany({
            where: {
              OR: [
                { role: "Manager", branchId: loan.branch.id },
                ...(recoveryOfficerId ? [{ id: recoveryOfficerId }] : []),
              ],
            },
          });
          for (const staff of escalationTargets) {
            if (!staff.email && !staff.phone) continue;
            await notifyStaffEscalation(
              { name: staff.name ?? staff.email, email: staff.email, phone: staff.phone ?? "" },
              recipient.name,
              daysOverdue,
              outstanding.penaltyDue
            );
          }
          notificationsQueued += escalationTargets.length;
        }
      }
    }
  }

  await invalidateTag(tags.loans);

  // Piggybacks on this daily trigger rather than its own Vercel Cron entry —
  // see lib/account-maintenance-fee.ts for why. Internally a no-op on every
  // day except the 1st (or if the fee isn't enabled in Settings).
  const maintenanceFeeResult =
    now.getUTCDate() === 1 ? await runMonthlyAccountMaintenanceFee() : { skipped: true as const, reason: "not_first_of_month" as const };

  return NextResponse.json({
    checked: activeLoans.length,
    flaggedOverdue,
    flaggedDefaulted,
    notificationsQueued,
    maintenanceFee: maintenanceFeeResult,
  });
}
