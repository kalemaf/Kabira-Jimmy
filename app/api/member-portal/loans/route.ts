import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { computeLoanDisplayStatus } from "@/lib/loan-status";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/** A member's own loans — nothing else. */
export async function GET() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });

  const loans = await db.loan.findMany({
    where: { memberId },
    orderBy: { disbursedAt: "desc" },
    include: {
      loanApplication: { include: { loanProduct: { select: { name: true } } } },
      repayments: { where: { status: "Confirmed" }, select: { principalPortion: true } },
    },
  });

  const data = loans.map((loan) => {
    const totalPrincipalRepaid = loan.repayments.reduce((s, r) => s + r.principalPortion, 0);
    const displayStatus = computeLoanDisplayStatus(loan, totalPrincipalRepaid);
    return {
      id: loan.id,
      productName: loan.loanApplication.loanProduct.name,
      principal: loan.principal,
      disbursedAt: loan.disbursedAt,
      status: loan.status,
      displayStatus,
    };
  });

  return NextResponse.json({ data });
}
