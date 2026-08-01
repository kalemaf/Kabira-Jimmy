import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const result = await getCachedOrFetch(
    `tag:${tags.ledger}:top-lists`,
    async () => {
      const [topBorrowers, topDefaulters, topSavers] = await Promise.all([
        db.loan.groupBy({
          by: ["memberId"],
          _sum: { principal: true },
          orderBy: { _sum: { principal: "desc" } },
          take: 5,
        }),
        db.loan.findMany({
          where: { status: "Defaulted" },
          orderBy: { principal: "desc" },
          take: 5,
          include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } },
        }),
        db.savingsAccount.findMany({
          orderBy: { balance: "desc" },
          take: 5,
          include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } },
        }),
      ]);

      const borrowerMembers = await db.member.findMany({
        where: { id: { in: topBorrowers.map((b) => b.memberId) } },
        select: { id: true, firstName: true, lastName: true, memberNumber: true },
      });
      const memberById = new Map(borrowerMembers.map((m) => [m.id, m]));

      return {
        topBorrowers: topBorrowers.map((b) => {
          const m = memberById.get(b.memberId);
          return {
            memberName: m ? `${m.firstName} ${m.lastName}` : "Unknown",
            memberNumber: m?.memberNumber ?? "",
            totalPrincipal: b._sum.principal ?? 0,
          };
        }),
        topDefaulters: topDefaulters.map((l) => ({
          memberName: `${l.member.firstName} ${l.member.lastName}`,
          memberNumber: l.member.memberNumber,
          principal: l.principal,
        })),
        topSavers: topSavers.map((s) => ({
          memberName: `${s.member.firstName} ${s.member.lastName}`,
          memberNumber: s.member.memberNumber,
          balance: s.balance,
        })),
      };
    },
    60
  );

  return NextResponse.json(result);
}
