import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { SavingsOverviewClient } from "@/components/dashboard/savings/savings-overview-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function SavingsOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role;

  if (role !== "SuperAdmin" && role !== "Manager") {
    redirect("/dashboard/savings");
  }

  return (
    <>
      <PageHeader
        title="Savings overview"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Savings", href: "/dashboard/savings" },
          { label: "Overview" },
        ]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role: role!,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load savings overview">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <SavingsOverviewClient />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
