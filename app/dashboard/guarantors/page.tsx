import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { GuarantorExposureClient } from "@/components/dashboard/guarantors/guarantor-exposure-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function GuarantorsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";

  return (
    <>
      <PageHeader
        title="Guarantor Exposure"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Guarantors" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load guarantor exposure">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <GuarantorExposureClient />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
