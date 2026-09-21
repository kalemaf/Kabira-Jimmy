/**
 * Pure, dependency-free loan math. No DB calls, no framework imports — every
 * function here takes plain inputs and returns plain outputs so it can be
 * unit tested in isolation. This is the ONLY place interest/amortization
 * math may live; never inline this logic in a component or API route.
 *
 * Rate convention: `monthlyRatePercent` is a MONTHLY rate (e.g. 2 means 2%
 * per month), matching how Nexcgen's seeded loan products are priced
 * (typical Ugandan SACCO practice quotes rates per month, not per annum).
 */

export type InterestMethod = "Flat" | "ReducingBalance" | "Declining" | "Compound" | "Custom";

export type AmortizationRow = {
  period: number;
  dueDate: string; // ISO date
  openingBalance: number;
  principal: number;
  interest: number;
  installment: number;
  closingBalance: number;
};

export type AmortizationSchedule = {
  rows: AmortizationRow[];
  totalPrincipal: number;
  totalInterest: number;
  totalPayable: number;
  monthlyInstallment: number | null; // null when installments vary period to period
};

export type AmortizationParams = {
  principal: number;
  monthlyRatePercent: number;
  periodMonths: number;
  method: InterestMethod;
  startDate?: Date;
  /** Only used when method === "Custom". Falls back to ReducingBalance if omitted. */
  customFormula?: (params: Omit<AmortizationParams, "customFormula">) => AmortizationSchedule;
};

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

// UGX has no practical subunit — every amount elsewhere in the app is a
// whole number (Zod `z.number().int()`, Prisma `Int` columns). Rounding to
// cents here would both misrepresent the currency and, worse, make
// installments drift by fractions of a shilling from row to row purely from
// floating-point noise (see `isLevelPayment` below).
function round(value: number): number {
  return Math.round(value);
}

function buildSchedule(
  principal: number,
  periodMonths: number,
  startDate: Date,
  periodPrincipal: (period: number, balance: number) => number,
  periodInterest: (period: number, balance: number) => number,
  /**
   * The theoretical level installment for methods that are level-payment BY
   * DESIGN (Flat, ReducingBalance, Compound), or null for methods that
   * genuinely vary period to period (Declining). This is computed from the
   * closed-form values BEFORE per-period rounding, so it's stable — unlike
   * inspecting `row.installment` across periods, which will legitimately
   * differ by ±1 shilling from period to period due to ordinary rounding
   * even on a mathematically level schedule (real bank amortization tables
   * have exactly this same behaviour).
   */
  nominalInstallment: number | null
): AmortizationSchedule {
  const rows: AmortizationRow[] = [];
  let balance = principal;
  let totalInterest = 0;

  for (let period = 1; period <= periodMonths; period++) {
    const opening = balance;
    const interest = round(periodInterest(period, opening));
    let principalPortion = round(periodPrincipal(period, opening));

    // Last period absorbs any rounding drift so the schedule sums exactly.
    if (period === periodMonths) {
      principalPortion = round(opening);
    }

    const installment = round(principalPortion + interest);
    const closing = round(opening - principalPortion);

    rows.push({
      period,
      dueDate: addMonths(startDate, period).toISOString(),
      openingBalance: opening,
      principal: principalPortion,
      interest,
      installment,
      closingBalance: Math.max(closing, 0),
    });

    balance = closing;
    totalInterest += interest;
  }

  const totalInterestRounded = round(totalInterest);

  return {
    rows,
    totalPrincipal: round(principal),
    totalInterest: totalInterestRounded,
    totalPayable: round(principal + totalInterestRounded),
    monthlyInstallment: nominalInstallment === null ? null : round(nominalInstallment),
  };
}

/** Flat rate: interest is charged on the ORIGINAL principal for every period. */
function flatRateSchedule(principal: number, monthlyRatePercent: number, periodMonths: number, startDate: Date) {
  const rate = monthlyRatePercent / 100;
  const flatInterestPerPeriod = round(principal * rate);
  const principalPerPeriod = principal / periodMonths;
  return buildSchedule(
    principal,
    periodMonths,
    startDate,
    () => principalPerPeriod,
    () => flatInterestPerPeriod,
    principalPerPeriod + flatInterestPerPeriod
  );
}

/** Reducing balance: equal total installment each period (standard annuity). */
function reducingBalanceSchedule(principal: number, monthlyRatePercent: number, periodMonths: number, startDate: Date) {
  const r = monthlyRatePercent / 100;

  if (r === 0) {
    const level = principal / periodMonths;
    return buildSchedule(principal, periodMonths, startDate, () => level, () => 0, level);
  }

  const factor = Math.pow(1 + r, periodMonths);
  const installment = (principal * r * factor) / (factor - 1);

  return buildSchedule(
    principal,
    periodMonths,
    startDate,
    (_period, balance) => installment - balance * r,
    (_period, balance) => balance * r,
    installment
  );
}

/** Declining balance: equal PRINCIPAL each period; interest (and installment) shrinks over time. */
function decliningBalanceSchedule(principal: number, monthlyRatePercent: number, periodMonths: number, startDate: Date) {
  const r = monthlyRatePercent / 100;
  const principalPerPeriod = principal / periodMonths;
  return buildSchedule(
    principal,
    periodMonths,
    startDate,
    () => principalPerPeriod,
    (_period, balance) => balance * r,
    null // installment genuinely shrinks over time — no single figure to report
  );
}

/**
 * Compound (add-on): total interest is computed via compound growth over the
 * full tenor up front — P * ((1+r)^n - 1) — then spread evenly across
 * periods alongside equal principal instalments. This is the common
 * "add-on compound" convention some SACCOs use, distinct from reducing
 * balance's period-by-period compounding.
 */
function compoundSchedule(principal: number, monthlyRatePercent: number, periodMonths: number, startDate: Date) {
  const r = monthlyRatePercent / 100;
  const totalInterest = principal * (Math.pow(1 + r, periodMonths) - 1);
  const interestPerPeriod = totalInterest / periodMonths;
  const principalPerPeriod = principal / periodMonths;
  return buildSchedule(
    principal,
    periodMonths,
    startDate,
    () => principalPerPeriod,
    () => interestPerPeriod,
    principalPerPeriod + interestPerPeriod
  );
}

export function generateAmortizationSchedule(params: AmortizationParams): AmortizationSchedule {
  const { principal, monthlyRatePercent, periodMonths, method, startDate = new Date() } = params;

  if (principal <= 0) throw new Error("Principal must be positive");
  if (periodMonths <= 0) throw new Error("Repayment period must be positive");

  switch (method) {
    case "Flat":
      return flatRateSchedule(principal, monthlyRatePercent, periodMonths, startDate);
    case "ReducingBalance":
      return reducingBalanceSchedule(principal, monthlyRatePercent, periodMonths, startDate);
    case "Declining":
      return decliningBalanceSchedule(principal, monthlyRatePercent, periodMonths, startDate);
    case "Compound":
      return compoundSchedule(principal, monthlyRatePercent, periodMonths, startDate);
    case "Custom":
      return params.customFormula
        ? params.customFormula(params)
        : reducingBalanceSchedule(principal, monthlyRatePercent, periodMonths, startDate);
    default: {
      const exhaustive: never = method;
      throw new Error(`Unknown interest method: ${exhaustive}`);
    }
  }
}

/** Upfront fees (processing/insurance/service), each a percentage of principal. */
export function calculateUpfrontFees(
  principal: number,
  fees: { processingFee: number; insuranceFee: number; serviceCharge: number }
): { processingFee: number; insuranceFee: number; serviceCharge: number; total: number } {
  const processingFee = round(principal * (fees.processingFee / 100));
  const insuranceFee = round(principal * (fees.insuranceFee / 100));
  const serviceCharge = round(principal * (fees.serviceCharge / 100));
  return {
    processingFee,
    insuranceFee,
    serviceCharge,
    total: round(processingFee + insuranceFee + serviceCharge),
  };
}

/** Late-payment penalty on an overdue installment, applied once per overdue period. */
export function calculatePenalty(overdueAmount: number, penaltyRatePercent: number): number {
  return round(overdueAmount * (penaltyRatePercent / 100));
}

/**
 * Splits an incoming repayment across penalty → interest → principal, in
 * that order (penalties and accrued interest are cleared before principal).
 */
export function splitRepayment(
  amountPaid: number,
  outstanding: { principalDue: number; interestDue: number; penaltyDue: number }
): { principalPortion: number; interestPortion: number; penaltyPortion: number } {
  let remaining = amountPaid;

  const penaltyPortion = Math.min(remaining, outstanding.penaltyDue);
  remaining -= penaltyPortion;

  const interestPortion = Math.min(remaining, outstanding.interestDue);
  remaining -= interestPortion;

  const principalPortion = Math.min(remaining, outstanding.principalDue);

  return {
    principalPortion: round(principalPortion),
    interestPortion: round(interestPortion),
    penaltyPortion: round(penaltyPortion),
  };
}

/**
 * What's currently owed on a loan: scheduled principal/interest up to
 * `asOfDate` minus what's already been confirmed-repaid, plus a penalty on
 * any installment amount that's gone unpaid past its due date.
 *
 * `principalDue`/`interestDue`/`totalDue` are deliberately scoped to
 * installments whose due date has already passed — that's what the
 * "Overdue" column and the penalty engine's arrears check need. They are
 * NOT the right figures to allocate an incoming payment against: a member
 * paying on or before their due date (the normal case, not the exception)
 * would otherwise have nothing "due" to apply the payment to.
 * `principalPayable`/`interestPayable` cover the FULL remaining schedule
 * (past and future installments) for that purpose — see splitRepayment.
 */
export function computeOutstandingBreakdown(
  schedule: AmortizationSchedule,
  confirmedRepayments: { principalPortion: number; interestPortion: number; penaltyPortion: number }[],
  penaltyRatePercent: number,
  asOfDate: Date = new Date(),
  /**
   * Sum of any InterestWaiver LoanAdjustments on this loan (see
   * prisma/schema.prisma's LoanAdjustment model). This app recognizes
   * interest on a cash basis — nothing is posted to the ledger for interest
   * until a repayment lands — so waiving future interest needs no reversing
   * ledger entry, just a reduction here in what's actually still owed.
   */
  waivedInterest = 0
): {
  principalDue: number;
  interestDue: number;
  penaltyDue: number;
  totalDue: number;
  principalPayable: number;
  interestPayable: number;
} {
  const totalRepaidPrincipal = confirmedRepayments.reduce((sum, r) => sum + r.principalPortion, 0);
  const totalRepaidInterest = confirmedRepayments.reduce((sum, r) => sum + r.interestPortion, 0);
  const totalRepaidPenalty = confirmedRepayments.reduce((sum, r) => sum + r.penaltyPortion, 0);

  let scheduledPrincipal = 0;
  let scheduledInterest = 0;
  let overdueInstallmentTotal = 0;

  for (const row of schedule.rows) {
    const dueDate = new Date(row.dueDate);
    if (dueDate <= asOfDate) {
      scheduledPrincipal += row.principal;
      scheduledInterest += row.interest;
    }
    if (dueDate < asOfDate) {
      overdueInstallmentTotal += row.installment;
    }
  }

  const principalDue = Math.max(round(scheduledPrincipal - totalRepaidPrincipal), 0);
  const interestDue = Math.max(round(scheduledInterest - totalRepaidInterest - waivedInterest), 0);

  const repaidTowardOverdue = Math.min(overdueInstallmentTotal, totalRepaidPrincipal + totalRepaidInterest);
  const unpaidOverdue = Math.max(overdueInstallmentTotal - repaidTowardOverdue, 0);
  const penaltyDue = Math.max(round(calculatePenalty(unpaidOverdue, penaltyRatePercent) - totalRepaidPenalty), 0);

  const principalPayable = Math.max(round(schedule.totalPrincipal - totalRepaidPrincipal), 0);
  const interestPayable = Math.max(round(schedule.totalInterest - totalRepaidInterest - waivedInterest), 0);

  return {
    principalDue,
    interestDue,
    penaltyDue,
    totalDue: round(principalDue + interestDue + penaltyDue),
    principalPayable,
    interestPayable,
  };
}
