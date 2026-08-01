import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { DashboardClient } from "@/components/dashboard/home/dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABELS, type StaffRole } from "@/components/dashboard/nav-config";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = ((session?.user as { role?: StaffRole })?.role ?? "LoanOfficer") as StaffRole;

  return (
    <>
      <PageHeader
        title="Dashboard"
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="mb-6">
          <p className="text-[13px] font-semibold tracking-[0.04em] text-(--accent-500) uppercase">
            Welcome
          </p>
          <h2 className="text-[22px] font-semibold text-(--text-primary)">
            Signed in as {session!.user.name}
          </h2>
          <p className="max-w-md text-sm text-(--text-secondary)">
            You&apos;re signed in as {ROLE_LABELS[role]}.
          </p>
        </div>
        <ErrorBoundary fallbackTitle="Couldn't load the dashboard">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <DashboardClient />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
