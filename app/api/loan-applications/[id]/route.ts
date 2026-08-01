import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const cacheKey = `tag:${tags.loanApplications}:detail:${id}`;

  const application = await getCachedOrFetch(
    cacheKey,
    () =>
      db.loanApplication.findUnique({
        where: { id },
        include: {
          member: true,
          loanProduct: true,
          preparedBy: { select: { id: true, name: true, email: true } },
          submittedByMemberUser: { select: { name: true, email: true } },
          guarantors: { include: { member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } } },
          collateral: true,
          approvalSteps: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
          loan: true,
        },
      }),
    20
  );

  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json(application);
}
