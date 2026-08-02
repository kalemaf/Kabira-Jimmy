import { requireRole } from "@/lib/auth-guard";
import { getWithdrawalPolicy, updateWithdrawalPolicy } from "@/lib/withdrawal-policy";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  minFlexibleSavingsBalance: z.number().int().min(0),
  fixedEarlyWithdrawalAllowed: z.boolean(),
  fixedEarlyWithdrawalPenaltyPercent: z.number().min(0).max(100),
  dailyWithdrawalAmountLimit: z.number().int().min(1),
  maxWithdrawalsPerDay: z.number().int().min(1),
  largeWithdrawalApprovalThreshold: z.number().int().min(1),
});

export async function GET() {
  const { error } = await requireRole(["SuperAdmin"]);
  if (error) return error;
  return NextResponse.json(await getWithdrawalPolicy());
}

export async function PUT(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await updateWithdrawalPolicy(parsed.data);

  await writeAuditLog({
    userId: session.user.id,
    action: "system_settings.withdrawal_policy_updated",
    entityType: "SystemSettings",
    entityId: "singleton",
    newValue: parsed.data,
    request: req,
  });

  return NextResponse.json(updated);
}
