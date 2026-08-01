import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { memberLoanApplicationSchema } from "@/lib/schemas/member-loan-application";
import { checkLoanEligibility, enforceGuarantorLimits } from "@/lib/loan-eligibility";
import { writeAuditLog } from "@/lib/audit";
import { invalidateTag, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/** A member's own loan applications — nothing else. */
export async function GET() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const applications = await db.loanApplication.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    include: { loanProduct: { select: { name: true } } },
  });

  return NextResponse.json({ data: applications });
}

/**
 * Member self-service loan application. Enters the SAME maker-checker
 * pipeline as a staff-prepared one (lib/loan-workflow.ts), just starting at
 * PendingLoanOfficer instead of PendingSecretary — a member has no
 * Secretary to prepare on their behalf, but a Loan Officer still has to vet
 * it before it reaches Manager review.
 */
export async function POST(req: Request) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const body = await req.json();
  const parsed = memberLoanApplicationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    loanProductId,
    amount,
    guarantors,
    collateral,
    idIssueDate,
    idExpiryDate,
    businessName,
    businessAddress,
    businessLocation,
    businessPhone,
    employerName,
    position,
    employerPhone,
    ...rest
  } = parsed.data;

  const loanProduct = await db.loanProduct.findUnique({ where: { id: loanProductId } });
  if (!loanProduct) return NextResponse.json({ error: "Loan product not found" }, { status: 404 });

  const monthlyIncome = (rest.netMonthlyIncome ?? 0) + (rest.businessMonthlyIncome ?? 0);

  const eligibility = await checkLoanEligibility({
    memberId,
    loanProductId,
    requestedAmount: amount,
    guarantorMemberIds: guarantors.map((g) => g.memberId),
    monthlyIncome,
    repaymentPeriodMonths: rest.repaymentPeriodMonths,
  });

  const application = await db.loanApplication.create({
    data: {
      memberId,
      loanProductId,
      amount,
      interestMethod: loanProduct.interestMethod,
      status: "PendingLoanOfficer",
      channel: "MemberPortal",
      submittedByMemberUserId: session.user.id,
      riskScore: eligibility.riskScore,
      riskFlags: eligibility.flags,
      ...rest,
      idIssueDate: idIssueDate ? new Date(idIssueDate) : null,
      idExpiryDate: idExpiryDate ? new Date(idExpiryDate) : null,
      businessName: businessName || null,
      businessAddress: businessAddress || null,
      businessLocation: businessLocation || null,
      businessPhone: businessPhone || null,
      employerName: employerName || null,
      position: position || null,
      employerPhone: employerPhone || null,
      guarantors: {
        create: guarantors.map((g) => ({ memberId: g.memberId, guaranteeAmount: g.guaranteeAmount })),
      },
      collateral: {
        create: collateral.map((c) => ({
          description: c.description,
          estimatedValue: c.estimatedValue,
          documentUrl: c.documentUrl || null,
        })),
      },
    },
    include: { guarantors: true, collateral: true },
  });

  if (guarantors.length > 0) {
    await enforceGuarantorLimits(guarantors.map((g) => g.memberId));
  }

  await writeAuditLog({
    userId: null,
    action: "loan_application.member_submitted",
    entityType: "LoanApplication",
    entityId: application.id,
    newValue: { memberId, loanProductId, amount, riskScore: eligibility.riskScore, submittedByMemberUserId: session.user.id },
    request: req,
  });

  await invalidateTag(tags.loanApplications);
  return NextResponse.json({ application, eligibility }, { status: 201 });
}
