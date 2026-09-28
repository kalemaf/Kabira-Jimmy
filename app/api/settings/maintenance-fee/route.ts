import { requireRole } from "@/lib/auth-guard";
import { getAccountMaintenanceFeePolicy, updateAccountMaintenanceFeePolicy } from "@/lib/account-maintenance-fee-policy";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  enabled: z.boolean(),
  amountUgx: z.number().int().min(0),
});

export async function GET() {
  const { error } = await requireRole(["SuperAdmin"]);
  if (error) return error;
  return NextResponse.json(await getAccountMaintenanceFeePolicy());
}

export async function PUT(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await updateAccountMaintenanceFeePolicy(parsed.data);

  await writeAuditLog({
    userId: session.user.id,
    action: "system_settings.maintenance_fee_updated",
    entityType: "SystemSettings",
    entityId: "singleton",
    newValue: parsed.data,
    request: req,
  });

  return NextResponse.json(updated);
}
