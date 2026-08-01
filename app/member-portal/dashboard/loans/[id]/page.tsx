import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberLoanDetail } from "@/components/member-portal/member-loan-detail";

export default async function MemberLoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await memberAuth.api.getSession({ headers: await headers() });

  if (!(await getLinkedMemberId(session!.user.id))) {
    redirect("/member-portal/dashboard");
  }

  const { id } = await params;

  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <MemberLoanDetail loanId={id} />
    </main>
  );
}
