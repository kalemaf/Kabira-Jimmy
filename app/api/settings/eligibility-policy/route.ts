import { requireSession, requireRole } from "@/lib/auth-guard";
import { getEligibilityPolicy, updateEligibilityPolicy } from "@/lib/eligibility-policy";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  savingsToLoanRatioPercent: z.number().min(0).max(100),
  maxDebtToIncomeRatioPercent: z.number().min(0).max(100),
  guarantorExposureLimitUgx: z.number().int().min(1),
  minimumSavingsForLoanUgx: z.number().int().min(0),
});

// GET is open to any staff session — the loan application wizard (used by
// Secretary/Treasurer/Manager/LoanOfficer, not just SuperAdmin) needs these
// numbers for its live affordability/savings preview. Only PUT (changing
// the policy) is SuperAdmin-only.
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  return NextResponse.json(await getEligibilityPolicy());
}

export async function PUT(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await updateEligibilityPolicy(parsed.data);

  await writeAuditLog({
    userId: session.user.id,
    action: "system_settings.eligibility_policy_updated",
    entityType: "SystemSettings",
    entityId: "singleton",
    newValue: parsed.data,
    request: req,
  });

  return NextResponse.json(updated);
}
