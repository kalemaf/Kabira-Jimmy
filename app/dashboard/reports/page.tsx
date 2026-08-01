import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReportsLanding } from "@/components/dashboard/reports/reports-landing";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function ReportsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";

  return (
    <>
      <PageHeader
        title="Reports"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ReportsLanding />
      </main>
    </>
  );
}
