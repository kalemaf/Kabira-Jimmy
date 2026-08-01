import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuditLogClient } from "@/components/dashboard/audit-log/audit-log-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function AuditLogPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role;

  if (!role || !["SuperAdmin", "Auditor"].includes(role)) {
    redirect("/dashboard");
  }

  return (
    <>
      <PageHeader
        title="Audit Log"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Audit Log" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load the audit log">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <AuditLogClient />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
