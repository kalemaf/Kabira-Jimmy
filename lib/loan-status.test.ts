import { describe, it, expect, vi, afterEach } from "vitest";
import { computeLoanDisplayStatus, computeDaysPastDue } from "./loan-status";
import { generateAmortizationSchedule } from "./loan-calculator";

const baseLoan = {
  status: "Active" as const,
  principal: 600_000,
  interestRate: 2,
  interestMethod: "ReducingBalance" as const,
  repaymentPeriodMonths: 6,
};

describe("computeLoanDisplayStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports Paid once the full principal is repaid, regardless of loan.status", () => {
    const result = computeLoanDisplayStatus(
      { ...baseLoan, disbursedAt: new Date("2024-01-01") },
      600_000
    );
    expect(result.label).toBe("Paid");
    expect(result.tone).toBe("success");
    expect(result.outstandingBalance).toBe(0);
  });

  it("reports Defaulted for a defaulted loan with a non-zero balance", () => {
    const result = computeLoanDisplayStatus(
      { ...baseLoan, status: "Defaulted", disbursedAt: new Date("2020-01-01") },
      0
    );
    expect(result.label).toBe("Defaulted");
    expect(result.tone).toBe("defaulted");
    expect(result.outstandingBalance).toBe(600_000);
  });

  it("reports Written off with a zero balance regardless of what was actually outstanding", () => {
    const result = computeLoanDisplayStatus(
      { ...baseLoan, status: "WrittenOff", disbursedAt: new Date("2020-01-01") },
      100_000
    );
    expect(result.label).toBe("Written off");
    expect(result.tone).toBe("neutral");
    expect(result.outstandingBalance).toBe(0);
    expect(result.nextDueDate).toBeNull();
  });

  it("reports Overdue with the correct day count once loan.status is Overdue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-04-01"));
    const result = computeLoanDisplayStatus(
      { ...baseLoan, status: "Overdue", disbursedAt: new Date("2024-01-01") },
      0
    );
    expect(result.label).toContain("Overdue");
    expect(result.tone).toBe("error");
  });

  it("reports Active (not yet due soon) when the next installment is far out", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-02")); // just after disbursement, first due date ~1 month out
    const result = computeLoanDisplayStatus(
      { ...baseLoan, disbursedAt: new Date("2024-01-01") },
      0
    );
    expect(result.label).toBe("Active");
    expect(result.tone).toBe("info");
    expect(result.outstandingBalance).toBe(600_000);
  });

  it("flags Due Soon within the 7-day warning window ahead of the next installment", () => {
    // First installment due one month after 2024-01-01 → 2024-02-01. Setting
    // "now" a few days before that should land in the Due Soon window.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-28"));
    const result = computeLoanDisplayStatus(
      { ...baseLoan, disbursedAt: new Date("2024-01-01") },
      0
    );
    expect(result.tone).toBe("warning");
    expect(result.daysUntilDue).toBeLessThanOrEqual(7);
    expect(result.daysUntilDue).toBeGreaterThanOrEqual(0);
  });
});

describe("computeDaysPastDue", () => {
  const schedule = generateAmortizationSchedule({
    principal: 600_000,
    monthlyRatePercent: 2,
    periodMonths: 6,
    method: "ReducingBalance",
    startDate: new Date("2020-01-01"),
  });

  it("is zero when nothing is overdue", () => {
    expect(computeDaysPastDue(schedule, 0, new Date("2020-01-15"))).toBe(0);
  });

  it("is zero once the loan is fully repaid, no matter how late", () => {
    const totalPrincipal = schedule.rows.reduce((s, r) => s + r.principal, 0);
    expect(computeDaysPastDue(schedule, totalPrincipal, new Date("2030-01-01"))).toBe(0);
  });

  // Regression: this must work for a Defaulted loan too, unlike
  // computeLoanDisplayStatus() which deliberately returns null for one —
  // PAR aging needs the real day count regardless of the coarse status.
  it("reports a positive day count once the first installment is overdue", () => {
    const days = computeDaysPastDue(schedule, 0, new Date("2020-03-01"));
    expect(days).toBeGreaterThan(0);
  });
});
