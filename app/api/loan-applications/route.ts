import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { createLoanApplicationSchema } from "@/lib/schemas/loan-application";
import { checkLoanEligibility, enforceGuarantorLimits } from "@/lib/loan-eligibility";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import type { Prisma, ApplicationStatus } from "@/lib/generated/prisma/client";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const status = searchParams.get("status")?.trim() ?? "";
  const memberId = searchParams.get("memberId")?.trim() ?? "";
  const preparedByUserId = searchParams.get("preparedByUserId")?.trim() ?? "";
  const cacheKey = `tag:${tags.loanApplications}:${page}:${limit}:${status}:${memberId}:${preparedByUserId}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean) as ApplicationStatus[];
      const where: Prisma.LoanApplicationWhereInput = {
        ...(statuses.length === 1
          ? { status: statuses[0] }
          : statuses.length > 1
            ? { status: { in: statuses } }
            : {}),
        ...(memberId ? { memberId } : {}),
        ...(preparedByUserId ? { preparedByUserId } : {}),
      };

      const [data, total] = await Promise.all([
        db.loanApplication.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
            loanProduct: { select: { id: true, name: true } },
            preparedBy: { select: { id: true, name: true } },
            submittedByMemberUser: { select: { name: true } },
          },
        }),
        db.loanApplication.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    20
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin", "Manager", "Secretary", "LoanOfficer"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createLoanApplicationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    memberId,
    loanProductId,
    amount,
    guarantors,
    collateral,
    idIssueDate,
    idExpiryDate,
    ninVerifiedAt,
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
      preparedByUserId: session.user.id,
      riskScore: eligibility.riskScore,
      riskFlags: eligibility.flags,
      ...rest,
      officerSignedAt: rest.officerSignatureData ? new Date() : null,
      idIssueDate: idIssueDate ? new Date(idIssueDate) : null,
      idExpiryDate: idExpiryDate ? new Date(idExpiryDate) : null,
      ninVerifiedAt: ninVerifiedAt ? new Date(ninVerifiedAt) : null,
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
    userId: session.user.id,
    action: "loan_application.create",
    entityType: "LoanApplication",
    entityId: application.id,
    newValue: { memberId, loanProductId, amount, riskScore: eligibility.riskScore },
    request: req,
  });

  await invalidateTag(tags.loanApplications);
  return NextResponse.json({ application, eligibility }, { status: 201 });
}
