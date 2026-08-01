import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { linkMemberSchema } from "@/lib/schemas/member-link";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Links a self-signed-up member-portal account to a real Member record.
 * Requires the member's own number + phone (both, not just one) so one
 * member can't claim another's account by guessing a sequential number.
 */
export async function POST(req: Request) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await getLinkedMemberId(session.user.id)) {
    return NextResponse.json({ error: "This account is already linked to a member" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = linkMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const member = await db.member.findUnique({ where: { memberNumber: parsed.data.memberNumber } });
  if (!member || member.phone !== parsed.data.phone) {
    return NextResponse.json(
      { error: "We couldn't find a member with that number and phone. Please check your details or contact your branch." },
      { status: 404 }
    );
  }

  const alreadyLinked = await db.memberUser.findUnique({ where: { memberId: member.id } });
  if (alreadyLinked) {
    return NextResponse.json(
      { error: "This member is already linked to a portal account. Contact your branch if this should be you." },
      { status: 409 }
    );
  }

  await db.memberUser.update({ where: { id: session.user.id }, data: { memberId: member.id } });

  // Determines who can now see/act on this member's financial data — a
  // security-sensitive event worth its own trail, same as any other access
  // grant in the system.
  await writeAuditLog({
    userId: null,
    action: "member_user.linked",
    entityType: "MemberUser",
    entityId: session.user.id,
    newValue: { memberId: member.id, memberNumber: member.memberNumber, memberUserEmail: session.user.email },
    request: req,
  });

  return NextResponse.json({ success: true, memberId: member.id });
}
