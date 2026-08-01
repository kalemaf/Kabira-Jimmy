import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { BranchesClient } from "@/components/dashboard/branches/branches-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function BranchesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role;

  if (role !== "SuperAdmin" && role !== "Manager") {
    redirect("/dashboard");
  }

  return (
    <>
      <PageHeader
        title="Branches"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Branches" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role: role!,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load branches">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <BranchesClient />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
