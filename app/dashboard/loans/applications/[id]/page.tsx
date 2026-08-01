import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApplicationDetail } from "@/components/dashboard/loan-applications/application-detail";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function LoanApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";

  return (
    <>
      <PageHeader
        title="Application review"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Applications", href: "/dashboard/loans/applications" },
          { label: "Review" },
        ]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ApplicationDetail applicationId={id} currentUserId={session!.user.id} role={role} />
      </main>
    </>
  );
}
