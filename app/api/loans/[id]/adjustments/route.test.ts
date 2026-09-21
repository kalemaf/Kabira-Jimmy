import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  loan: { findUnique: vi.fn(), update: vi.fn() },
  loanAdjustment: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth-guard", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/cache", () => ({
  invalidateTag: vi.fn(),
  tags: { loans: "loans", ledger: "ledger" },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/ledger", () => ({ postLedgerEntries: vi.fn(), ACCOUNTS: { LOAN_LOSS_PROVISION: "5030", LOANS_RECEIVABLE: "1100" } }));

import { requireRole } from "@/lib/auth-guard";
import { postLedgerEntries } from "@/lib/ledger";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/loans/loan1/adjustments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const baseLoan = {
  id: "loan1",
  principal: 600_000,
  interestRate: 2,
  interestMethod: "ReducingBalance" as const,
  repaymentPeriodMonths: 6,
  disbursedAt: new Date("2024-01-01"),
  branchId: "branch1",
  status: "Active" as const,
  repayments: [],
  adjustments: [],
  loanApplication: { loanProduct: {} },
};

describe("POST /api/loans/[id]/adjustments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({ session: { user: { id: "user-1" } } as never, error: null });
  });

  it("refuses to restructure an already Paid Off loan", async () => {
    mockDb.loan.findUnique.mockResolvedValue({ ...baseLoan, status: "PaidOff" });
    const res = await POST(makeReq({ type: "WriteOff", amount: 1000, reason: "member disputes disbursement" }), {
      params: Promise.resolve({ id: "loan1" }),
    });
    expect(res.status).toBe(400);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a write-off larger than the outstanding principal", async () => {
    mockDb.loan.findUnique.mockResolvedValue(baseLoan);
    const res = await POST(
      makeReq({ type: "WriteOff", amount: 700_000, reason: "far exceeds outstanding principal" }),
      { params: Promise.resolve({ id: "loan1" }) }
    );
    expect(res.status).toBe(400);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("writes off part of the balance, posts balanced ledger entries, and keeps the loan Active", async () => {
    mockDb.loan.findUnique.mockResolvedValue(baseLoan);
    mockDb.$transaction.mockResolvedValue([{}, { id: "adj1", type: "WriteOff", amount: 100_000 }]);

    const res = await POST(makeReq({ type: "WriteOff", amount: 100_000, reason: "partial loss agreed with member" }), {
      params: Promise.resolve({ id: "loan1" }),
    });

    expect(res.status).toBe(201);
    expect(postLedgerEntries).toHaveBeenCalledWith([
      expect.objectContaining({ accountCode: "5030", debit: 100_000 }),
      expect.objectContaining({ accountCode: "1100", credit: 100_000 }),
    ]);
  });

  it("closes the loan as WrittenOff when the write-off covers the full outstanding principal", async () => {
    mockDb.loan.findUnique.mockResolvedValue(baseLoan);
    mockDb.$transaction.mockResolvedValue([{}, { id: "adj1", type: "WriteOff", amount: 600_000 }]);

    await POST(makeReq({ type: "WriteOff", amount: 600_000, reason: "member relocated, uncollectible" }), {
      params: Promise.resolve({ id: "loan1" }),
    });

    expect(mockDb.loan.update).toHaveBeenCalledWith({ where: { id: "loan1" }, data: { status: "WrittenOff" } });
  });

  it("refuses a reschedule to the same period", async () => {
    mockDb.loan.findUnique.mockResolvedValue(baseLoan);
    const res = await POST(
      makeReq({ type: "Reschedule", newRepaymentPeriodMonths: 6, reason: "no actual change requested here" }),
      { params: Promise.resolve({ id: "loan1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("reschedules to a new period without touching the ledger", async () => {
    mockDb.loan.findUnique.mockResolvedValue(baseLoan);
    mockDb.$transaction.mockResolvedValue([{}, { id: "adj1", type: "Reschedule" }]);

    const res = await POST(
      makeReq({ type: "Reschedule", newRepaymentPeriodMonths: 12, reason: "member requested longer term" }),
      { params: Promise.resolve({ id: "loan1" }) }
    );

    expect(res.status).toBe(201);
    expect(postLedgerEntries).not.toHaveBeenCalled();
  });

  it("refuses an interest waiver larger than the outstanding interest", async () => {
    mockDb.loan.findUnique.mockResolvedValue(baseLoan);
    const res = await POST(
      makeReq({ type: "InterestWaiver", amount: 10_000_000, reason: "far exceeds any real interest owed" }),
      { params: Promise.resolve({ id: "loan1" }) }
    );
    expect(res.status).toBe(400);
  });
});
