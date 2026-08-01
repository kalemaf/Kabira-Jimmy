import { db } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { updateStaffSchema } from "@/lib/schemas/staff";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateStaffSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (id === session.user.id && parsed.data.role && parsed.data.role !== "SuperAdmin") {
    return NextResponse.json(
      { error: "You cannot demote your own account" },
      { status: 400 }
    );
  }

  const before = await db.user.findUnique({
    where: { id },
    select: { role: true, branchId: true, phone: true, nationalIdNumber: true },
  });
  if (!before) return NextResponse.json({ error: "Staff account not found" }, { status: 404 });

  const user = await db.user.update({ where: { id }, data: parsed.data });

  // Role/branch changes govern what a staff member can approve, disburse,
  // and see — these must be traceable to who made the change and when, same
  // as any other loan-lifecycle mutation.
  await writeAuditLog({
    userId: session.user.id,
    action: "staff.updated",
    entityType: "User",
    entityId: id,
    oldValue: before,
    newValue: parsed.data,
    request: req,
  });

  await invalidateTag(tags.staff);
  return NextResponse.json(user);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { role } = session.user as { role?: string };
  if (role !== "SuperAdmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  const target = await db.user.findUnique({
    where: { id },
    select: { name: true, email: true, role: true, branchId: true },
  });
  if (!target) return NextResponse.json({ error: "Staff account not found" }, { status: 404 });

  await db.session.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } });

  await writeAuditLog({
    userId: session.user.id,
    action: "staff.deactivated",
    entityType: "User",
    entityId: id,
    oldValue: target,
    request: req,
  });

  await invalidateTag(tags.staff);
  return NextResponse.json({ success: true });
}
