import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { SavingsListClient } from "@/components/dashboard/savings/savings-list-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function SavingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";
  const canCreate = ["SuperAdmin", "Manager", "Secretary", "Cashier"].includes(role);

  return (
    <>
      <PageHeader
        title="Savings"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Savings" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load savings accounts">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <SavingsListClient canCreate={canCreate} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
