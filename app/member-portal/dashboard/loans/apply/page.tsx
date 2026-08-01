import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberLoanApplicationForm } from "@/components/member-portal/member-loan-application-form";

export default async function MemberLoanApplyPage() {
  const session = await memberAuth.api.getSession({ headers: await headers() });

  if (!(await getLinkedMemberId(session!.user.id))) {
    redirect("/member-portal/dashboard");
  }

  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <h1 className="mb-1 text-[20px] font-semibold text-(--text-primary)">Apply for a loan</h1>
      <p className="mb-6 text-sm text-(--text-secondary)">
        Your application goes to a Loan Officer for review, then a Manager for final approval —
        the same process staff-submitted applications go through.
      </p>
      <MemberLoanApplicationForm />
    </main>
  );
}
