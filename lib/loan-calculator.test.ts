import { describe, it, expect } from "vitest";
import {
  generateAmortizationSchedule,
  calculateUpfrontFees,
  calculatePenalty,
  splitRepayment,
  computeOutstandingBreakdown,
} from "./loan-calculator";

describe("generateAmortizationSchedule", () => {
  it("Flat: charges interest on the original principal every period", () => {
    const schedule = generateAmortizationSchedule({
      principal: 1_000_000,
      monthlyRatePercent: 2,
      periodMonths: 6,
      method: "Flat",
    });
    // Every row's interest should be identical (2% of the original 1,000,000).
    const interests = schedule.rows.map((r) => r.interest);
    expect(new Set(interests).size).toBe(1);
    expect(interests[0]).toBe(20_000);
    expect(schedule.totalPrincipal).toBe(1_000_000);
    // Schedule must fully amortize — closing balance hits exactly zero.
    expect(schedule.rows.at(-1)!.closingBalance).toBe(0);
  });

  it("ReducingBalance: produces a level installment (standard annuity)", () => {
    const schedule = generateAmortizationSchedule({
      principal: 1_000_000,
      monthlyRatePercent: 2,
      periodMonths: 12,
      method: "ReducingBalance",
    });
    expect(schedule.monthlyInstallment).not.toBeNull();
    // Every row's installment should be within a shilling of the nominal
    // level payment — the last row absorbs rounding drift only.
    for (const row of schedule.rows.slice(0, -1)) {
      expect(Math.abs(row.installment - schedule.monthlyInstallment!)).toBeLessThanOrEqual(1);
    }
    expect(schedule.rows.at(-1)!.closingBalance).toBe(0);
  });

  it("ReducingBalance: interest declines each period as balance shrinks", () => {
    const schedule = generateAmortizationSchedule({
      principal: 1_000_000,
      monthlyRatePercent: 2,
      periodMonths: 6,
      method: "ReducingBalance",
    });
    for (let i = 1; i < schedule.rows.length; i++) {
      expect(schedule.rows[i].interest).toBeLessThan(schedule.rows[i - 1].interest);
    }
  });

  it("Declining: equal principal each period, no single nominal installment", () => {
    const schedule = generateAmortizationSchedule({
      principal: 1_200_000,
      monthlyRatePercent: 2,
      periodMonths: 6,
      method: "Declining",
    });
    expect(schedule.monthlyInstallment).toBeNull();
    const principals = schedule.rows.map((r) => r.principal);
    // First 5 periods should be equal principal (1,200,000/6 = 200,000);
    // the last period absorbs rounding drift instead.
    for (const p of principals.slice(0, -1)) {
      expect(p).toBe(200_000);
    }
    expect(schedule.rows.at(-1)!.closingBalance).toBe(0);
    // Installments must shrink over time (declining interest on declining balance).
    for (let i = 1; i < schedule.rows.length; i++) {
      expect(schedule.rows[i].installment).toBeLessThanOrEqual(schedule.rows[i - 1].installment);
    }
  });

  it("rejects non-positive principal or period", () => {
    expect(() =>
      generateAmortizationSchedule({ principal: 0, monthlyRatePercent: 2, periodMonths: 6, method: "Flat" })
    ).toThrow();
    expect(() =>
      generateAmortizationSchedule({ principal: 100, monthlyRatePercent: 2, periodMonths: 0, method: "Flat" })
    ).toThrow();
  });

  it("handles a zero interest rate without dividing by zero", () => {
    const schedule = generateAmortizationSchedule({
      principal: 600_000,
      monthlyRatePercent: 0,
      periodMonths: 6,
      method: "ReducingBalance",
    });
    expect(schedule.totalInterest).toBe(0);
    expect(schedule.rows.at(-1)!.closingBalance).toBe(0);
  });
});

describe("calculateUpfrontFees", () => {
  it("computes each fee as a percentage of principal and sums them", () => {
    const fees = calculateUpfrontFees(1_000_000, { processingFee: 2, insuranceFee: 1, serviceCharge: 0.5 });
    expect(fees.processingFee).toBe(20_000);
    expect(fees.insuranceFee).toBe(10_000);
    expect(fees.serviceCharge).toBe(5_000);
    expect(fees.total).toBe(35_000);
  });
});

describe("calculatePenalty", () => {
  it("computes a percentage of the overdue amount", () => {
    expect(calculatePenalty(100_000, 5)).toBe(5_000);
  });
});

describe("splitRepayment", () => {
  it("applies payment in penalty → interest → principal order", () => {
    const result = splitRepayment(50_000, { principalDue: 100_000, interestDue: 20_000, penaltyDue: 10_000 });
    expect(result.penaltyPortion).toBe(10_000);
    expect(result.interestPortion).toBe(20_000);
    expect(result.principalPortion).toBe(20_000);
  });

  it("never allocates more than what's actually due in each bucket", () => {
    const result = splitRepayment(1_000_000, { principalDue: 100_000, interestDue: 20_000, penaltyDue: 10_000 });
    expect(result.penaltyPortion).toBe(10_000);
    expect(result.interestPortion).toBe(20_000);
    expect(result.principalPortion).toBe(100_000);
    // Total allocated must never exceed the amount actually owed.
    expect(result.penaltyPortion + result.interestPortion + result.principalPortion).toBe(130_000);
  });

  it("a partial payment smaller than the penalty only clears penalty", () => {
    const result = splitRepayment(5_000, { principalDue: 100_000, interestDue: 20_000, penaltyDue: 10_000 });
    expect(result.penaltyPortion).toBe(5_000);
    expect(result.interestPortion).toBe(0);
    expect(result.principalPortion).toBe(0);
  });
});

describe("computeOutstandingBreakdown", () => {
  it("reports zero due once every scheduled installment up to now is fully repaid", () => {
    const schedule = generateAmortizationSchedule({
      principal: 600_000,
      monthlyRatePercent: 2,
      periodMonths: 6,
      method: "ReducingBalance",
      startDate: new Date("2020-01-01"),
    });
    const confirmedRepayments = schedule.rows.map((r) => ({
      principalPortion: r.principal,
      interestPortion: r.interest,
      penaltyPortion: 0,
    }));
    const outstanding = computeOutstandingBreakdown(schedule, confirmedRepayments, 5, new Date("2025-01-01"));
    expect(outstanding.principalDue).toBe(0);
    expect(outstanding.interestDue).toBe(0);
    expect(outstanding.penaltyDue).toBe(0);
    expect(outstanding.totalDue).toBe(0);
  });

  it("flags an unpaid past-due installment as owed, with a penalty accrued on it", () => {
    const schedule = generateAmortizationSchedule({
      principal: 600_000,
      monthlyRatePercent: 2,
      periodMonths: 6,
      method: "ReducingBalance",
      startDate: new Date("2020-01-01"),
    });
    // asOfDate is far in the future relative to startDate, with nothing repaid.
    const outstanding = computeOutstandingBreakdown(schedule, [], 5, new Date("2020-08-01"));
    expect(outstanding.principalDue).toBeGreaterThan(0);
    expect(outstanding.interestDue).toBeGreaterThan(0);
    expect(outstanding.penaltyDue).toBeGreaterThan(0);
    expect(outstanding.totalDue).toBe(outstanding.principalDue + outstanding.interestDue + outstanding.penaltyDue);
  });
});
