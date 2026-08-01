import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberSavingsClient } from "@/components/member-portal/member-savings-client";

export default async function MemberSavingsPage() {
  const session = await memberAuth.api.getSession({ headers: await headers() });

  if (!(await getLinkedMemberId(session!.user.id))) {
    redirect("/member-portal/dashboard");
  }

  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <h1 className="mb-6 text-[20px] font-semibold text-(--text-primary)">My savings</h1>
      <MemberSavingsClient />
    </main>
  );
}
