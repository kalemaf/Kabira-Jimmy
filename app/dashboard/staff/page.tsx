import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { StaffClient } from "@/components/dashboard/staff/staff-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function StaffPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role;

  if (role !== "SuperAdmin") {
    redirect("/dashboard");
  }

  return (
    <>
      <PageHeader
        title="Staff"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Staff" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role: role!,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load staff">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <StaffClient currentUserId={session!.user.id} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
