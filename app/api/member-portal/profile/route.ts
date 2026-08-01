import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { memberProfileUpdateSchema } from "@/lib/schemas/member-profile";
import { writeAuditLog } from "@/lib/audit";
import { invalidateTag, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const member = await db.member.findUnique({
    where: { id: memberId },
    include: { branch: { select: { name: true } } },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  return NextResponse.json(member);
}

/** Members may only edit their own non-identity fields — see the schema's comment. */
export async function PATCH(req: Request) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const body = await req.json();
  const parsed = memberProfileUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const before = await db.member.findUnique({ where: { id: memberId } });
  if (!before) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const data = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v])
  );

  const member = await db.member.update({ where: { id: memberId }, data });

  await writeAuditLog({
    userId: null,
    action: "member.self_updated_profile",
    entityType: "Member",
    entityId: memberId,
    oldValue: before,
    newValue: parsed.data,
    request: req,
  });

  await invalidateTag(tags.members);
  return NextResponse.json(member);
}
