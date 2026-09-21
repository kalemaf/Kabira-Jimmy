import { describe, it, expect } from "vitest";
import { loanProductSchema } from "./loan-product";

const validProduct = {
  name: "Emergency Loan",
  interestRate: 3,
  minAmount: 50_000,
  maxAmount: 1_000_000,
  repaymentPeriodMonths: 3,
  gracePeriodDays: 3,
  penaltyRate: 2,
  processingFee: 1,
  insuranceFee: 0.5,
  lateFee: 1,
  serviceCharge: 0.5,
  interestMethod: "Flat" as const,
  isActive: true,
};

describe("loanProductSchema", () => {
  it("accepts a valid product", () => {
    expect(loanProductSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rejects maxAmount below minAmount", () => {
    const result = loanProductSchema.safeParse({ ...validProduct, minAmount: 1_000_000, maxAmount: 50_000 });
    expect(result.success).toBe(false);
  });

  // Regression: the PATCH /api/loan-products/[id] route once called
  // loanProductSchema.partial().safeParse(body) — Zod throws synchronously
  // when .partial() is called on a schema built with .refine() (this one
  // has a maxAmount >= minAmount refinement), so every single product edit
  // 500'd unconditionally, before validation even ran. This guards the
  // schema itself: calling .partial() on it must throw, so nobody
  // reintroduces that call on the API route without this test failing loud
  // in the route, not silently in production.
  it("throws when .partial() is called on it, since it carries a .refine()", () => {
    expect(() => (loanProductSchema as unknown as { partial: () => unknown }).partial()).toThrow();
  });

  it("full (non-partial) parse is the correct way to validate a PATCH body", () => {
    // The actual fix: PATCH validates with the full schema since the edit
    // form always submits every field anyway (see loan-product-form.tsx).
    const result = loanProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });
});
