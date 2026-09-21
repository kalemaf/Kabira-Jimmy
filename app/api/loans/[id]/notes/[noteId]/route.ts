import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { updateLoanNoteDisputeSchema } from "@/lib/schemas/loan-note";
import { NextResponse } from "next/server";

/**
 * Moves a dispute note (see prisma/schema.prisma's LoanNote.isDispute) along
 * its Open → Investigating → Resolved lifecycle. This is the only mutation
 * a note supports — the note's own text is append-only, same as before.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { noteId } = await params;
  const body = await req.json();
  const parsed = updateLoanNoteDisputeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const note = await db.loanNote.findUnique({ where: { id: noteId } });
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  if (!note.isDispute) return NextResponse.json({ error: "This note isn't flagged as a dispute" }, { status: 400 });

  const { disputeStatus } = parsed.data;
  const updated = await db.loanNote.update({
    where: { id: noteId },
    data: {
      disputeStatus,
      resolvedAt: disputeStatus === "Resolved" ? new Date() : null,
      resolvedByUserId: disputeStatus === "Resolved" ? session.user.id : null,
    },
    include: { author: { select: { name: true, role: true } }, resolvedBy: { select: { name: true } } },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "loan_note.dispute_status_changed",
    entityType: "Loan",
    entityId: note.loanId,
    oldValue: { disputeStatus: note.disputeStatus },
    newValue: { disputeStatus },
    request: req,
  });

  await invalidateTag(tags.loans);
  return NextResponse.json(updated);
}
