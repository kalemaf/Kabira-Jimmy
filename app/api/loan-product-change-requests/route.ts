import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { writeAuditLog } from "@/lib/audit";
import { loanProductSchema } from "@/lib/schemas/loan-product";
import { NextResponse } from "next/server";
import { z } from "zod";

const createChangeRequestSchema = z.object({
  targetProductId: z.string().optional(),
  changes: loanProductSchema,
});

/**
 * Maker-checker for loan products (see prisma/schema.prisma's
 * LoanProductChangeRequest doc comment). A SuperAdmin/Manager proposes a
 * create (no targetProductId) or update (targetProductId set) as a pending
 * JSON diff here; nothing on the real LoanProduct changes until a different
 * SuperAdmin/Manager approves it via .../[id]/approve. This is the only way
 * a loan product can change now — POST /api/loan-products and
 * PATCH /api/loan-products/[id] have been retired.
 */
export async function GET(req: Request) {
  const { error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const requests = await db.loanProductChangeRequest.findMany({
    where: status ? { status: status as "Pending" | "Approved" | "Rejected" } : undefined,
    include: {
      targetProduct: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: requests });
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createChangeRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { targetProductId, changes } = parsed.data;

  if (targetProductId) {
    const existing = await db.loanProduct.findUnique({ where: { id: targetProductId } });
    if (!existing) return NextResponse.json({ error: "Loan product not found" }, { status: 404 });
  }

  const changeRequest = await db.loanProductChangeRequest.create({
    data: {
      targetProductId: targetProductId ?? null,
      changes,
      requestedByUserId: session.user.id,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: targetProductId ? "loan_product.change_requested" : "loan_product.create_requested",
    entityType: "LoanProductChangeRequest",
    entityId: changeRequest.id,
    newValue: { targetProductId, changes },
    request: req,
  });

  return NextResponse.json(changeRequest, { status: 201 });
}
