import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const reviewSchema = z.object({
  action: z.enum(["Approve", "Reject"]),
  comments: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const changeRequest = await db.loanProductChangeRequest.findUnique({ where: { id } });
  if (!changeRequest) return NextResponse.json({ error: "Change request not found" }, { status: 404 });
  if (changeRequest.status !== "Pending") {
    return NextResponse.json({ error: "This change request has already been reviewed" }, { status: 400 });
  }

  // Maker-checker: whoever proposed the change cannot be the one who
  // approves it — same rule as the loan-application workflow.
  if (session.user.id === changeRequest.requestedByUserId) {
    return NextResponse.json(
      { error: "You cannot approve or reject a change request you submitted yourself" },
      { status: 403 }
    );
  }

  const { action, comments } = parsed.data;

  if (action === "Reject") {
    const updated = await db.loanProductChangeRequest.update({
      where: { id },
      data: { status: "Rejected", reviewedByUserId: session.user.id, reviewedAt: new Date(), comments },
    });
    await writeAuditLog({
      userId: session.user.id,
      action: "loan_product.change_rejected",
      entityType: "LoanProductChangeRequest",
      entityId: id,
      newValue: { comments },
      request: req,
    });
    return NextResponse.json(updated);
  }

  const changes = changeRequest.changes as Record<string, unknown>;

  const product = changeRequest.targetProductId
    ? await db.loanProduct.findUnique({ where: { id: changeRequest.targetProductId } })
    : null;
  if (changeRequest.targetProductId && !product) {
    return NextResponse.json(
      { error: "The loan product this change targeted no longer exists" },
      { status: 409 }
    );
  }

  const [savedProduct] = await db.$transaction([
    changeRequest.targetProductId
      ? db.loanProduct.update({ where: { id: changeRequest.targetProductId }, data: changes })
      : db.loanProduct.create({ data: changes as never }),
    db.loanProductChangeRequest.update({
      where: { id },
      data: { status: "Approved", reviewedByUserId: session.user.id, reviewedAt: new Date(), comments },
    }),
  ]);

  await writeAuditLog({
    userId: session.user.id,
    action: changeRequest.targetProductId ? "loan_product.updated" : "loan_product.created",
    entityType: "LoanProduct",
    entityId: savedProduct.id,
    oldValue: product ?? undefined,
    newValue: changes,
    request: req,
  });

  await invalidateTag(tags.loanProducts);
  return NextResponse.json(savedProduct);
}
