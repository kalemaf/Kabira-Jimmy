import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { RepaymentCollection } from "@/components/dashboard/repayments/repayment-collection";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function RepaymentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";

  return (
    <>
      <PageHeader
        title="Repayments"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Repayments" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load the repayment screen">
          <Suspense fallback={<Skeleton className="h-96 w-full max-w-xl rounded-lg" />}>
            <RepaymentCollection />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
