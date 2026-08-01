import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/** Active loan products a member can apply for — just enough to pick a product and preview terms. */
export async function GET() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await db.loanProduct.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      interestRate: true,
      interestMethod: true,
      minAmount: true,
      maxAmount: true,
      repaymentPeriodMonths: true,
      processingFee: true,
      insuranceFee: true,
      serviceCharge: true,
    },
  });

  return NextResponse.json({ data: products });
}
