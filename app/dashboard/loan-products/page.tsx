import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoanProductsClient } from "@/components/dashboard/loan-products/loan-products-client";
import { PendingChangeRequests } from "@/components/dashboard/loan-products/pending-change-requests";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function LoanProductsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";
  const canEdit = role === "SuperAdmin" || role === "Manager";

  return (
    <>
      <PageHeader
        title="Loan Products"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Loan Products" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 space-y-6 px-4 py-6 md:px-8">
        {canEdit ? (
          <ErrorBoundary fallbackTitle="Couldn't load pending changes">
            <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
              <PendingChangeRequests currentUserId={session!.user.id} />
            </Suspense>
          </ErrorBoundary>
        ) : null}
        <ErrorBoundary fallbackTitle="Couldn't load loan products">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <LoanProductsClient canEdit={canEdit} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
