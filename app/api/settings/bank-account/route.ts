import { requireSession, requireRole } from "@/lib/auth-guard";
import { getBankAccountDetails, updateBankAccountDetails } from "@/lib/bank-account-policy";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  bankName: z.string().trim().min(1).max(100).nullable(),
  bankAccountName: z.string().trim().min(1).max(100).nullable(),
  bankAccountNumber: z.string().trim().min(1).max(50).nullable(),
  bankBranch: z.string().trim().max(100).nullable(),
});

// GET is open to any staff session — the same pattern as
// /api/settings/repayment-fee-policy: staff recording/confirming a Bank
// Transfer deposit need to see these details too, not just SuperAdmin.
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  return NextResponse.json(await getBankAccountDetails());
}

export async function PUT(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await updateBankAccountDetails(parsed.data);

  await writeAuditLog({
    userId: session.user.id,
    action: "system_settings.bank_account_updated",
    entityType: "SystemSettings",
    entityId: "singleton",
    newValue: parsed.data,
    request: req,
  });

  return NextResponse.json(updated);
}
