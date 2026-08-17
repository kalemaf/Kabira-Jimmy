import { requireSession, requireRole } from "@/lib/auth-guard";
import { getMobileMoneyRepaymentFeePercent, updateMobileMoneyRepaymentFeePercent } from "@/lib/repayment-fee-policy";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  mobileMoneyRepaymentFeePercent: z.number().min(0).max(100),
});

// GET is open to any staff session — the repayment collection form (used by
// Cashier/LoanOfficer/Manager, not just SuperAdmin) needs this to preview
// the fee before sending a Mobile Money prompt. Only PUT is SuperAdmin-only.
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  return NextResponse.json({ mobileMoneyRepaymentFeePercent: await getMobileMoneyRepaymentFeePercent() });
}

export async function PUT(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await updateMobileMoneyRepaymentFeePercent(parsed.data.mobileMoneyRepaymentFeePercent);

  await writeAuditLog({
    userId: session.user.id,
    action: "system_settings.repayment_fee_policy_updated",
    entityType: "SystemSettings",
    entityId: "singleton",
    newValue: parsed.data,
    request: req,
  });

  return NextResponse.json({ mobileMoneyRepaymentFeePercent: updated });
}
