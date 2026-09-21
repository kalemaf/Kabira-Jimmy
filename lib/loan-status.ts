import { generateAmortizationSchedule, type InterestMethod } from "@/lib/loan-calculator";

export type LoanDisplayTone = "success" | "info" | "warning" | "accent" | "error" | "defaulted" | "neutral";

export type LoanDisplayStatus = {
  label: string;
  tone: LoanDisplayTone;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  outstandingBalance: number;
};

/**
 * Loan status colour is computed at render/query time from due dates and
 * payment history — never stored — per master_prompt.md's domain rule.
 * `loan.status` (Active/PaidOff/Overdue/Defaulted) is the coarse lifecycle
 * state maintained by the penalty engine / recovery process; this function
 * layers the finer Near-Due / Due-Soon warning states on top of it.
 */
export function computeLoanDisplayStatus(
  loan: {
    status: "Active" | "PaidOff" | "Overdue" | "Defaulted" | "WrittenOff";
    principal: number;
    interestRate: number;
    interestMethod: InterestMethod;
    repaymentPeriodMonths: number;
    disbursedAt: Date | string;
  },
  totalPrincipalRepaid: number
): LoanDisplayStatus {
  // Written off closes the loan as an uncollectible loss — no further
  // schedule/due-date math applies, same as Paid, just a different reason
  // the balance is settled.
  if (loan.status === "WrittenOff") {
    return { label: "Written off", tone: "neutral", nextDueDate: null, daysUntilDue: null, outstandingBalance: 0 };
  }

  const schedule = generateAmortizationSchedule({
    principal: loan.principal,
    monthlyRatePercent: loan.interestRate,
    periodMonths: loan.repaymentPeriodMonths,
    method: loan.interestMethod,
    startDate: new Date(loan.disbursedAt),
  });

  const outstandingBalance = Math.max(loan.principal - totalPrincipalRepaid, 0);

  if (loan.status === "PaidOff" || outstandingBalance <= 0) {
    return { label: "Paid", tone: "success", nextDueDate: null, daysUntilDue: null, outstandingBalance: 0 };
  }

  if (loan.status === "Defaulted") {
    return {
      label: "Defaulted",
      tone: "defaulted",
      nextDueDate: null,
      daysUntilDue: null,
      outstandingBalance,
    };
  }

  // Find the first schedule row not yet fully covered by repaid principal.
  let cumulativePrincipal = 0;
  let nextRow = schedule.rows[schedule.rows.length - 1];
  for (const row of schedule.rows) {
    cumulativePrincipal += row.principal;
    if (cumulativePrincipal > totalPrincipalRepaid) {
      nextRow = row;
      break;
    }
  }

  const nextDueDate = new Date(nextRow.dueDate);
  const daysUntilDue = Math.ceil((nextDueDate.getTime() - Date.now()) / 86_400_000);

  if (loan.status === "Overdue" || daysUntilDue < 0) {
    return {
      label: `Overdue · ${Math.abs(daysUntilDue)}d`,
      tone: "error",
      nextDueDate: nextRow.dueDate,
      daysUntilDue,
      outstandingBalance,
    };
  }

  if (daysUntilDue === 0) {
    return {
      label: "Due today",
      tone: "accent",
      nextDueDate: nextRow.dueDate,
      daysUntilDue,
      outstandingBalance,
    };
  }

  if (daysUntilDue <= 7) {
    return {
      label: `Due in ${daysUntilDue}d`,
      tone: "warning",
      nextDueDate: nextRow.dueDate,
      daysUntilDue,
      outstandingBalance,
    };
  }

  return {
    label: "Active",
    tone: "info",
    nextDueDate: nextRow.dueDate,
    daysUntilDue,
    outstandingBalance,
  };
}

/**
 * Days since the earliest schedule installment not yet fully covered by
 * repaid principal — 0 if nothing is overdue (or the loan is fully repaid).
 * Used for PAR aging (see lib/par-provisioning.ts), which needs an actual
 * day count regardless of the loan's coarse status label: unlike
 * computeLoanDisplayStatus() above, this works for a Defaulted loan too
 * (that function deliberately returns null for one, since "how overdue" no
 * longer matters once a loan is already written off as a collections
 * problem — but PAR aging is exactly the report that needs to know).
 */
export function computeDaysPastDue(
  schedule: { rows: { principal: number; dueDate: string }[] },
  totalPrincipalRepaid: number,
  asOfDate: Date = new Date()
): number {
  let cumulativePrincipal = 0;
  for (const row of schedule.rows) {
    cumulativePrincipal += row.principal;
    if (cumulativePrincipal > totalPrincipalRepaid) {
      const daysPast = Math.floor((asOfDate.getTime() - new Date(row.dueDate).getTime()) / 86_400_000);
      return Math.max(daysPast, 0);
    }
  }
  return 0;
}
