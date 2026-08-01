import { db } from "@/lib/db";

/**
 * The authoritative "is this member-portal account linked, and to whom"
 * check. Deliberately bypasses the session entirely rather than trusting
 * `session.user.memberId` — Better Auth caches the session+user payload in
 * both the cookie (cookieCache) and secondaryStorage (Redis), and the
 * link-account route sets memberId via a raw Prisma update (not through
 * Better Auth's own API, since memberId is a server-only additionalField),
 * so neither cache layer knows to invalidate. A direct DB read is the only
 * way to get the current value right after linking.
 */
export async function getLinkedMemberId(memberUserId: string): Promise<string | null> {
  const user = await db.memberUser.findUnique({ where: { id: memberUserId }, select: { memberId: true } });
  return user?.memberId ?? null;
}
