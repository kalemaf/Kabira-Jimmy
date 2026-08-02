import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.discriminatedUnion("frozen", [
  z.object({ frozen: z.literal(true), reason: z.string().min(3, "Enter a reason").max(300) }),
  z.object({ frozen: z.literal(false) }),
]);

/** Freezes/unfreezes self-service withdrawals for a member under investigation — see lib/withdrawal-eligibility.ts. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const member = await db.member.findUnique({ where: { id } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const updated = await db.member.update({
    where: { id },
    data: parsed.data.frozen
      ? { withdrawalsFrozen: true, frozenReason: parsed.data.reason, frozenAt: new Date() }
      : { withdrawalsFrozen: false, frozenReason: null, frozenAt: null },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: parsed.data.frozen ? "member.withdrawals_frozen" : "member.withdrawals_unfrozen",
    entityType: "Member",
    entityId: id,
    newValue: parsed.data.frozen ? { reason: parsed.data.reason } : {},
    request: req,
  });

  await invalidateTag(tags.members);
  return NextResponse.json(updated);
}
