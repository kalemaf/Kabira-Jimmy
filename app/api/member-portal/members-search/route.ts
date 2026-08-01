import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Minimal member lookup for picking a guarantor — name + member number
 * only, never phone/email/balances. A member needs to be able to find
 * another member by name or number to ask them to guarantee a loan; this
 * is deliberately the smallest slice of member data that makes that
 * possible.
 */
export async function GET(req: Request) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const selfMemberId = await getLinkedMemberId(session.user.id);
  if (!selfMemberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  if (search.length < 2) return NextResponse.json({ data: [] });

  const members = await db.member.findMany({
    where: {
      status: "Active",
      id: { not: selfMemberId },
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { memberNumber: { contains: search, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
    take: 20,
  });

  return NextResponse.json({ data: members });
}
