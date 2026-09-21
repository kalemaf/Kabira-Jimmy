import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  loanProductChangeRequest: { findUnique: vi.fn(), update: vi.fn() },
  loanProduct: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth-guard", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/cache", () => ({ invalidateTag: vi.fn(), tags: { loanProducts: "loan-products" } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));

import { requireRole } from "@/lib/auth-guard";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/loan-product-change-requests/req1/approve", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/loan-product-change-requests/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to let the requester approve their own change request (maker-checker)", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      session: { user: { id: "user-1" } } as never,
      error: null,
    });
    mockDb.loanProductChangeRequest.findUnique.mockResolvedValue({
      id: "req1",
      status: "Pending",
      requestedByUserId: "user-1",
      targetProductId: null,
      changes: { name: "New Loan" },
    });

    const res = await POST(makeReq({ action: "Approve" }), { params: Promise.resolve({ id: "req1" }) });

    expect(res.status).toBe(403);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("applies the change and marks it Approved when a different user reviews it", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      session: { user: { id: "user-2" } } as never,
      error: null,
    });
    mockDb.loanProductChangeRequest.findUnique.mockResolvedValue({
      id: "req1",
      status: "Pending",
      requestedByUserId: "user-1",
      targetProductId: "product-1",
      changes: { name: "Renamed Loan", interestRate: 5 },
    });
    mockDb.loanProduct.findUnique.mockResolvedValue({ id: "product-1", name: "Old Loan", interestRate: 3 });
    mockDb.$transaction.mockResolvedValue([{ id: "product-1", name: "Renamed Loan", interestRate: 5 }, {}]);

    const res = await POST(makeReq({ action: "Approve" }), { params: Promise.resolve({ id: "req1" }) });

    expect(res.status).toBe(200);
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects without touching the LoanProduct table", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      session: { user: { id: "user-2" } } as never,
      error: null,
    });
    mockDb.loanProductChangeRequest.findUnique.mockResolvedValue({
      id: "req1",
      status: "Pending",
      requestedByUserId: "user-1",
      targetProductId: "product-1",
      changes: { name: "Renamed Loan" },
    });
    mockDb.loanProductChangeRequest.update.mockResolvedValue({ id: "req1", status: "Rejected" });

    const res = await POST(makeReq({ action: "Reject", comments: "not needed" }), {
      params: Promise.resolve({ id: "req1" }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(mockDb.loanProduct.update).not.toHaveBeenCalled();
  });

  it("refuses to review a change request that's already been decided", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      session: { user: { id: "user-2" } } as never,
      error: null,
    });
    mockDb.loanProductChangeRequest.findUnique.mockResolvedValue({
      id: "req1",
      status: "Approved",
      requestedByUserId: "user-1",
      targetProductId: "product-1",
      changes: {},
    });

    const res = await POST(makeReq({ action: "Approve" }), { params: Promise.resolve({ id: "req1" }) });

    expect(res.status).toBe(400);
  });
});
