import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  loanNote: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/auth-guard", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/cache", () => ({ invalidateTag: vi.fn(), tags: { loans: "loans" } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn() }));

import { requireSession } from "@/lib/auth-guard";
import { PATCH } from "./route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/loans/loan1/notes/note1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/loans/[id]/notes/[noteId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue({ session: { user: { id: "user-1" } } as never, error: null });
  });

  it("refuses to change dispute status on a note that isn't flagged as a dispute", async () => {
    mockDb.loanNote.findUnique.mockResolvedValue({ id: "note1", loanId: "loan1", isDispute: false, disputeStatus: null });
    const res = await PATCH(makeReq({ disputeStatus: "Resolved" }), {
      params: Promise.resolve({ id: "loan1", noteId: "note1" }),
    });
    expect(res.status).toBe(400);
    expect(mockDb.loanNote.update).not.toHaveBeenCalled();
  });

  it("stamps resolvedAt/resolvedByUserId when marking Resolved", async () => {
    mockDb.loanNote.findUnique.mockResolvedValue({ id: "note1", loanId: "loan1", isDispute: true, disputeStatus: "Open" });
    mockDb.loanNote.update.mockResolvedValue({ id: "note1", disputeStatus: "Resolved" });

    const res = await PATCH(makeReq({ disputeStatus: "Resolved" }), {
      params: Promise.resolve({ id: "loan1", noteId: "note1" }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.loanNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ disputeStatus: "Resolved", resolvedByUserId: "user-1" }),
      })
    );
  });

  it("clears resolvedAt/resolvedByUserId when moving back to Investigating", async () => {
    mockDb.loanNote.findUnique.mockResolvedValue({ id: "note1", loanId: "loan1", isDispute: true, disputeStatus: "Open" });
    mockDb.loanNote.update.mockResolvedValue({ id: "note1", disputeStatus: "Investigating" });

    await PATCH(makeReq({ disputeStatus: "Investigating" }), {
      params: Promise.resolve({ id: "loan1", noteId: "note1" }),
    });

    expect(mockDb.loanNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ disputeStatus: "Investigating", resolvedByUserId: null, resolvedAt: null }),
      })
    );
  });
});
