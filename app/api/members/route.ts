import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { memberSchema } from "@/lib/schemas/member";
import { computeLoanDisplayStatus } from "@/lib/loan-status";
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
  const branchId = searchParams.get("branchId")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const cacheKey = `tag:${tags.members}:${page}:${limit}:${search}:${branchId}:${status}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where: Prisma.MemberWhereInput = {
        ...(branchId ? { branchId } : {}),
        ...(status ? { status: status as Prisma.MemberWhereInput["status"] } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { phone: { contains: search, mode: "insensitive" as const } },
                { nin: { contains: search, mode: "insensitive" as const } },
                { memberNumber: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [members, total] = await Promise.all([
        db.member.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            branch: { select: { id: true, name: true, code: true } },
            savingsAccounts: { select: { balance: true } },
            loans: {
              where: { status: { in: ["Active", "Overdue"] } },
              orderBy: { disbursedAt: "desc" },
              take: 1,
              include: { repayments: { where: { status: "Confirmed" }, select: { principalPortion: true } } },
            },
          },
        }),
        db.member.count({ where }),
      ]);

      const data = members.map((m) => {
        const { savingsAccounts, loans, ...member } = m;
        const savingsBalance = savingsAccounts.reduce((sum, a) => sum + a.balance, 0);

        const currentLoan = loans[0];
        let activeLoan = null;
        if (currentLoan) {
          const totalPrincipalRepaid = currentLoan.repayments.reduce((sum, r) => sum + r.principalPortion, 0);
          const displayStatus = computeLoanDisplayStatus(currentLoan, totalPrincipalRepaid);
          activeLoan = {
            id: currentLoan.id,
            principal: currentLoan.principal,
            outstandingBalance: displayStatus.outstandingBalance,
            nextDueDate: displayStatus.nextDueDate,
            label: displayStatus.label,
            tone: displayStatus.tone,
          };
        }

        return { ...member, savingsBalance, activeLoan };
      });

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    30
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "Secretary", "LoanOfficer"]);
  if (error) return error;

  const body = await req.json();
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { email, nin, photoUrl, signatureUrl, ...rest } = parsed.data;

  const created = await db.member.create({
    data: {
      ...rest,
      email: email || null,
      nin: nin || null,
      photoUrl: photoUrl || null,
      signatureUrl: signatureUrl || null,
      memberNumber: `PENDING-${Date.now()}`,
    },
  });

  const member = await db.member.update({
    where: { id: created.id },
    data: { memberNumber: `NGS-${String(created.sequenceNumber).padStart(6, "0")}` },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "member.create",
    entityType: "Member",
    entityId: member.id,
    newValue: { memberNumber: member.memberNumber, firstName: member.firstName, lastName: member.lastName, branchId: member.branchId },
    request: req,
  });

  await invalidateTag(tags.members);
  return NextResponse.json(member, { status: 201 });
}
