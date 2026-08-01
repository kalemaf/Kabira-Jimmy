import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReportViewer } from "@/components/dashboard/reports/report-viewer";
import { REPORT_TYPES } from "@/lib/reports";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function ReportTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const report = REPORT_TYPES.find((r) => r.type === type);
  if (!report) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";

  return (
    <>
      <PageHeader
        title={report.label}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports", href: "/dashboard/reports" },
          { label: report.label },
        ]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ReportViewer type={report.type} title={report.label} />
      </main>
    </>
  );
}
