import { db } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { memberDocumentSchema } from "@/lib/schemas/member-document";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const documents = await db.memberDocument.findMany({
    where: { memberId: id },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json({ data: documents });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "Secretary", "LoanOfficer"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = memberDocumentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const member = await db.member.findUnique({ where: { id }, select: { id: true } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const document = await db.memberDocument.create({
    data: { memberId: id, type: parsed.data.type, fileUrl: parsed.data.fileUrl },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "member_document.upload",
    entityType: "MemberDocument",
    entityId: document.id,
    newValue: { memberId: id, type: parsed.data.type },
    request: req,
  });

  await invalidateTag(tags.memberDocuments);
  await invalidateTag(tags.members);
  return NextResponse.json(document, { status: 201 });
}
