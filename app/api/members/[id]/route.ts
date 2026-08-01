import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { memberSchema } from "@/lib/schemas/member";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const cacheKey = `tag:${tags.members}:detail:${id}`;

  const member = await getCachedOrFetch(
    cacheKey,
    () =>
      db.member.findUnique({
        where: { id },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          documents: true,
          guarantors: true,
        },
      }),
    30
  );

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "Secretary", "LoanOfficer"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = memberSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const before = await db.member.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const { email, nin, photoUrl, signatureUrl, ...rest } = parsed.data;

  const member = await db.member.update({
    where: { id },
    data: {
      ...rest,
      ...(email !== undefined ? { email: email || null } : {}),
      ...(nin !== undefined ? { nin: nin || null } : {}),
      ...(photoUrl !== undefined ? { photoUrl: photoUrl || null } : {}),
      ...(signatureUrl !== undefined ? { signatureUrl: signatureUrl || null } : {}),
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "member.update",
    entityType: "Member",
    entityId: id,
    oldValue: before,
    newValue: parsed.data,
    request: req,
  });

  await invalidateTag(tags.members);
  return NextResponse.json(member);
}
