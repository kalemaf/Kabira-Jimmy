import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { createRecoveryCaseSchema } from "@/lib/schemas/recovery";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const status = searchParams.get("status")?.trim() ?? "";
  const cacheKey = `tag:${tags.recovery}:${page}:${limit}:${status}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where = status ? { status: status as "Active" | "Promised" | "Legal" | "Blacklisted" | "Recovered" } : {};

      const [cases, total, unassignedDefaulters] = await Promise.all([
        db.recoveryCase.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { updatedAt: "desc" },
          include: {
            loan: {
              include: {
                member: { select: { id: true, firstName: true, lastName: true, memberNumber: true, phone: true } },
                branch: { select: { name: true } },
              },
            },
            recoveryOfficer: { select: { id: true, name: true } },
          },
        }),
        db.recoveryCase.count({ where }),
        db.loan.findMany({
          where: { status: { in: ["Overdue", "Defaulted"] }, recoveryCase: null },
          include: {
            member: { select: { id: true, firstName: true, lastName: true, memberNumber: true, phone: true } },
            branch: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
      ]);

      return { data: cases, total, page, limit, totalPages: Math.ceil(total / limit), unassignedDefaulters };
    },
    30
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "RecoveryOfficer"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createRecoveryCaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const loan = await db.loan.findUnique({ where: { id: parsed.data.loanId } });
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  if (!["Overdue", "Defaulted"].includes(loan.status)) {
    return NextResponse.json({ error: "Only overdue or defaulted loans can open a recovery case" }, { status: 400 });
  }

  const existing = await db.recoveryCase.findUnique({ where: { loanId: parsed.data.loanId } });
  if (existing) return NextResponse.json({ error: "A recovery case already exists for this loan" }, { status: 409 });

  const recoveryCase = await db.recoveryCase.create({
    data: { loanId: parsed.data.loanId, recoveryOfficerId: parsed.data.recoveryOfficerId || null },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "recovery_case.create",
    entityType: "RecoveryCase",
    entityId: recoveryCase.id,
    newValue: parsed.data,
    request: req,
  });

  await invalidateTag(tags.recovery);
  return NextResponse.json(recoveryCase, { status: 201 });
}
