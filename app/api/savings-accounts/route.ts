import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { createSavingsAccountSchema } from "@/lib/schemas/savings";
import { postLedgerEntries, buildSavingsLedgerLines } from "@/lib/ledger";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const search = searchParams.get("search")?.trim() ?? "";
  const memberId = searchParams.get("memberId")?.trim() ?? "";
  const cacheKey = `tag:${tags.savings}:${page}:${limit}:${search}:${memberId}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where: Prisma.SavingsAccountWhereInput = {
        ...(memberId ? { memberId } : {}),
        ...(search
          ? {
              member: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" as const } },
                  { lastName: { contains: search, mode: "insensitive" as const } },
                  { memberNumber: { contains: search, mode: "insensitive" as const } },
                ],
              },
            }
          : {}),
      };

      const [data, total, byTypeAgg] = await Promise.all([
        db.savingsAccount.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { member: { select: { id: true, firstName: true, lastName: true, memberNumber: true, branchId: true } } },
        }),
        db.savingsAccount.count({ where }),
        db.savingsAccount.groupBy({
          by: ["type"],
          where,
          _sum: { balance: true },
          _count: { _all: true },
        }),
      ]);

      const totalBalance = byTypeAgg.reduce((sum, g) => sum + (g._sum.balance ?? 0), 0);
      const byType = Object.fromEntries(
        byTypeAgg.map((g) => [g.type, { count: g._count._all, balance: g._sum.balance ?? 0 }])
      );

      return { data, total, page, limit, totalPages: Math.ceil(total / limit), totalBalance, byType };
    },
    30
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "Secretary", "Cashier"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createSavingsAccountSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { memberId, type, openingDeposit } = parsed.data;

  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const count = await db.savingsAccount.count();
  const accountNumber = `SAV-${String(count + 1).padStart(6, "0")}`;

  const account = await db.savingsAccount.create({
    data: { accountNumber, memberId, type, balance: openingDeposit },
  });

  if (openingDeposit > 0) {
    await db.savingsTransaction.create({
      data: {
        savingsAccountId: account.id,
        type: "Deposit",
        amount: openingDeposit,
        balanceAfter: openingDeposit,
        branchId: member.branchId,
        staffId: session.user.id,
      },
    });

    await postLedgerEntries(
      buildSavingsLedgerLines({
        id: account.id,
        referenceType: "SavingsAccount",
        description: `Opening deposit — ${accountNumber}`,
        type: "Deposit",
        amount: openingDeposit,
        branchId: member.branchId,
      })
    );
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "savings_account.create",
    entityType: "SavingsAccount",
    entityId: account.id,
    newValue: { memberId, type, openingDeposit },
    request: req,
  });

  await invalidateTag(tags.savings);
  return NextResponse.json(account, { status: 201 });
}
