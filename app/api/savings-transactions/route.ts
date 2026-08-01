import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { createSavingsTransactionSchema } from "@/lib/schemas/savings";
import { postLedgerEntries, buildSavingsLedgerLines } from "@/lib/ledger";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const savingsAccountId = searchParams.get("savingsAccountId")?.trim() ?? "";
  const cacheKey = `tag:${tags.savings}:transactions:${page}:${limit}:${savingsAccountId}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where = savingsAccountId ? { savingsAccountId } : {};
      const [data, total] = await Promise.all([
        db.savingsTransaction.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { staff: { select: { name: true } } },
        }),
        db.savingsTransaction.count({ where }),
      ]);
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    20
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "Cashier"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createSavingsTransactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { savingsAccountId, type, amount } = parsed.data;

  const account = await db.savingsAccount.findUnique({
    where: { id: savingsAccountId },
    include: { member: { select: { branchId: true } } },
  });
  if (!account) return NextResponse.json({ error: "Savings account not found" }, { status: 404 });

  if (type === "Withdrawal" && amount > account.balance) {
    return NextResponse.json(
      { error: `Insufficient balance — available ${account.balance}` },
      { status: 400 }
    );
  }

  const balanceAfter = type === "Deposit" ? account.balance + amount : account.balance - amount;
  const branchId = account.member.branchId;

  const [, transaction] = await db.$transaction([
    db.savingsAccount.update({ where: { id: savingsAccountId }, data: { balance: balanceAfter } }),
    db.savingsTransaction.create({
      data: {
        savingsAccountId,
        type,
        amount,
        balanceAfter,
        branchId,
        staffId: session.user.id,
      },
    }),
  ]);

  await postLedgerEntries(
    buildSavingsLedgerLines({
      id: transaction.id,
      referenceType: "SavingsTransaction",
      description: `${type} — ${account.accountNumber}`,
      type,
      amount,
      branchId,
    })
  );

  await writeAuditLog({
    userId: session.user.id,
    action: `savings_transaction.${type.toLowerCase()}`,
    entityType: "SavingsTransaction",
    entityId: transaction.id,
    newValue: { savingsAccountId, type, amount, balanceAfter },
    request: req,
  });

  await invalidateTag(tags.savings);
  return NextResponse.json({ transaction, balanceAfter }, { status: 201 });
}
