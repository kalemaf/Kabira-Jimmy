import { memberAuth } from "@/lib/member-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/member-portal/member-header";

export const dynamic = "force-dynamic";

export default async function MemberDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await memberAuth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/member-portal/auth/sign-in");
  }

  return (
    <div className="flex min-h-screen flex-col bg-(--bg-canvas)">
      <MemberHeader name={session.user.name} />
      {children}
    </div>
  );
}
