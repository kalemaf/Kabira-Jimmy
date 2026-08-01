import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";
import { notifyApprovalStatus } from "@/lib/notify";
import { approvalActionSchema } from "@/lib/schemas/loan-application";
import { STATUS_STAGE, NEXT_STATUS_ON_APPROVE, canActAtStage } from "@/lib/loan-workflow";
import type { StaffRole } from "@/components/dashboard/nav-config";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = approvalActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const application = await db.loanApplication.findUnique({
    where: { id },
    include: { member: { select: { firstName: true, lastName: true, email: true, phone: true } } },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const stage = STATUS_STAGE[application.status];
  if (!stage || stage === "Disbursement") {
    return NextResponse.json(
      { error: "This application is not awaiting Secretary, Treasurer, or Manager review. Use the disbursement endpoint for the Disbursement stage." },
      { status: 400 }
    );
  }

  const role = (session.user as { role?: StaffRole }).role;
  if (!role || !canActAtStage(role, stage)) {
    return NextResponse.json({ error: "Forbidden — you cannot act at this approval stage" }, { status: 403 });
  }

  // Maker-checker: the approver must never be the preparer, at any stage.
  if (session.user.id === application.preparedByUserId) {
    return NextResponse.json(
      { error: "You cannot approve, reject, or return an application you prepared yourself" },
      { status: 403 }
    );
  }

  const { action, comments } = parsed.data;
  const nextStatus =
    action === "Approve"
      ? NEXT_STATUS_ON_APPROVE[stage]
      : action === "Reject"
        ? ("Rejected" as const)
        : ("Returned" as const);

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? null;

  const [updated] = await db.$transaction([
    db.loanApplication.update({ where: { id }, data: { status: nextStatus } }),
    db.approvalStep.create({
      data: {
        loanApplicationId: id,
        stage,
        userId: session.user.id,
        action,
        comments: comments || null,
        ipAddress,
      },
    }),
  ]);

  await writeAuditLog({
    userId: session.user.id,
    action: `loan_application.${action.toLowerCase()}`,
    entityType: "LoanApplication",
    entityId: id,
    oldValue: { status: application.status },
    newValue: { status: nextStatus, stage, comments },
    request: req,
  });

  await invalidateTag(tags.loanApplications);

  // Only the terminal negative outcomes notify the member immediately —
  // intermediate Secretary/Treasurer/Manager approvals don't (that would be
  // one SMS per stage). Final disbursement sends its own confirmation.
  if (action === "Reject" || action === "Return") {
    await notifyApprovalStatus(
      { name: `${application.member.firstName} ${application.member.lastName}`, email: application.member.email, phone: application.member.phone },
      application.amount,
      action === "Reject" ? "Rejected" : "Returned",
      comments
    );
  }

  return NextResponse.json(updated);
}
