import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { updateRecoveryCaseSchema } from "@/lib/schemas/recovery";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "RecoveryOfficer"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateRecoveryCaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await db.recoveryCase.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Recovery case not found" }, { status: 404 });

  const recoveryCase = await db.recoveryCase.update({
    where: { id },
    data: { ...parsed.data, recoveryOfficerId: parsed.data.recoveryOfficerId ?? undefined },
  });

  if (parsed.data.status === "Recovered") {
    await db.loan.update({ where: { id: existing.loanId }, data: { status: "PaidOff" } }).catch(() => {});
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "recovery_case.update",
    entityType: "RecoveryCase",
    entityId: id,
    oldValue: existing,
    newValue: parsed.data,
    request: req,
  });

  await invalidateTag(tags.recovery);
  return NextResponse.json(recoveryCase);
}
