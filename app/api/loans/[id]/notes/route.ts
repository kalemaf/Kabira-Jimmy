import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { createLoanNoteSchema } from "@/lib/schemas/loan-note";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const cacheKey = `tag:${tags.loans}:notes:${id}`;

  const notes = await getCachedOrFetch(
    cacheKey,
    () =>
      db.loanNote.findMany({
        where: { loanId: id },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, role: true } }, resolvedBy: { select: { name: true } } },
      }),
    30
  );

  return NextResponse.json({ data: notes });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = createLoanNoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const loan = await db.loan.findUnique({ where: { id } });
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

  const note = await db.loanNote.create({
    data: {
      loanId: id,
      authorId: session.user.id,
      body: parsed.data.body,
      isDispute: parsed.data.isDispute ?? false,
      disputeStatus: parsed.data.isDispute ? "Open" : null,
    },
    include: { author: { select: { name: true, role: true } }, resolvedBy: { select: { name: true } } },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: parsed.data.isDispute ? "loan_note.dispute_flagged" : "loan_note.create",
    entityType: "Loan",
    entityId: id,
    newValue: { body: parsed.data.body, isDispute: parsed.data.isDispute ?? false },
    request: req,
  });

  await invalidateTag(tags.loans);
  return NextResponse.json(note, { status: 201 });
}
