import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { MemberProfileTabs } from "@/components/dashboard/members/member-profile-tabs";
import { computeLoanDisplayStatus } from "@/lib/loan-status";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";

  const member = await db.member.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, name: true, code: true } },
      documents: true,
      guarantors: true,
      savingsAccounts: { orderBy: { openedAt: "desc" } },
      loans: {
        orderBy: { disbursedAt: "desc" },
        include: {
          loanApplication: { include: { loanProduct: { select: { name: true } } } },
          repayments: { where: { status: "Confirmed" }, select: { principalPortion: true } },
        },
      },
    },
  });

  if (!member) notFound();

  const loans = member.loans.map((loan) => {
    const totalPrincipalRepaid = loan.repayments.reduce((sum, r) => sum + r.principalPortion, 0);
    const displayStatus = computeLoanDisplayStatus(loan, totalPrincipalRepaid);
    return {
      id: loan.id,
      principal: loan.principal,
      disbursedAt: loan.disbursedAt.toISOString(),
      productName: loan.loanApplication.loanProduct.name,
      displayStatus,
    };
  });

  return (
    <>
      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Members", href: "/dashboard/members" },
          { label: member.memberNumber },
        ]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <MemberProfileTabs
          member={{
            ...member,
            dob: member.dob?.toISOString() ?? null,
            dateJoined: member.dateJoined.toISOString(),
            documents: member.documents.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() })),
            guarantors: member.guarantors.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })),
            savingsAccounts: member.savingsAccounts.map((s) => ({
              id: s.id,
              accountNumber: s.accountNumber,
              type: s.type,
              balance: s.balance,
              openedAt: s.openedAt.toISOString(),
            })),
            loans,
          }}
        />
      </main>
    </>
  );
}
