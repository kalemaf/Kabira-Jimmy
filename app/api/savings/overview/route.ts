import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

const STREAK_DAYS = 14;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Per-member savings roll-up for branch managers/admins: total balance
 * across every account, and — for members with a Daily savings account —
 * a day-by-day deposit streak over the last two weeks, so a manager can
 * spot who's skipping their daily contribution at a glance.
 */
export async function GET(req: Request) {
  const { error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const search = searchParams.get("search")?.trim() ?? "";
  const branchId = searchParams.get("branchId")?.trim() ?? "";
  const cacheKey = `tag:${tags.savings}:overview:${page}:${limit}:${search}:${branchId}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where: Prisma.MemberWhereInput = {
        ...(branchId ? { branchId } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { memberNumber: { contains: search, mode: "insensitive" as const } },
                { phone: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [members, total] = await Promise.all([
        db.member.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { memberNumber: "asc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberNumber: true,
            status: true,
            branch: { select: { name: true } },
            savingsAccounts: { select: { id: true, type: true, balance: true } },
          },
        }),
        db.member.count({ where }),
      ]);

      const dailyAccountIds = members.flatMap((m) =>
        m.savingsAccounts.filter((a) => a.type === "Daily").map((a) => a.id)
      );

      // accountId -> set of "YYYY-MM-DD" days that had a confirmed deposit.
      const depositDaysByAccount = new Map<string, Set<string>>();
      if (dailyAccountIds.length > 0) {
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - (STREAK_DAYS - 1));
        since.setUTCHours(0, 0, 0, 0);

        const deposits = await db.savingsTransaction.findMany({
          where: { savingsAccountId: { in: dailyAccountIds }, type: "Deposit", status: "Confirmed", createdAt: { gte: since } },
          select: { savingsAccountId: true, createdAt: true },
        });
        for (const d of deposits) {
          const set = depositDaysByAccount.get(d.savingsAccountId) ?? new Set<string>();
          set.add(dayKey(d.createdAt));
          depositDaysByAccount.set(d.savingsAccountId, set);
        }
      }

      const today = new Date();
      const last14Days = Array.from({ length: STREAK_DAYS }, (_, i) => {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - (STREAK_DAYS - 1 - i));
        return dayKey(d);
      });

      const data = members.map((m) => {
        const totalBalance = m.savingsAccounts.reduce((sum, a) => sum + a.balance, 0);
        const dailyAccounts = m.savingsAccounts.filter((a) => a.type === "Daily");
        const hasDailyAccount = dailyAccounts.length > 0;

        const dailyStreak = hasDailyAccount
          ? last14Days.map((date) => ({
              date,
              saved: dailyAccounts.some((a) => depositDaysByAccount.get(a.id)?.has(date)),
            }))
          : [];

        return {
          memberId: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          memberNumber: m.memberNumber,
          status: m.status,
          branchName: m.branch.name,
          totalBalance,
          accountCount: m.savingsAccounts.length,
          hasDailyAccount,
          dailyStreak,
        };
      });

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    30
  );

  return NextResponse.json(result);
}
