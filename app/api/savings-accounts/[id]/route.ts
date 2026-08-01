import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const cacheKey = `tag:${tags.savings}:detail:${id}`;

  const account = await getCachedOrFetch(
    cacheKey,
    () =>
      db.savingsAccount.findUnique({
        where: { id },
        include: {
          member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
          transactions: {
            orderBy: { createdAt: "desc" },
            include: {
              staff: { select: { name: true } },
              memberUser: { select: { name: true } },
              confirmedBy: { select: { name: true } },
            },
          },
        },
      }),
    30
  );

  if (!account) return NextResponse.json({ error: "Savings account not found" }, { status: 404 });
  return NextResponse.json(account);
}
