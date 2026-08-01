import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { MemberRegistrationForm } from "@/components/dashboard/members/member-registration-form";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function NewMemberPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role;

  if (!role || !["SuperAdmin", "Manager", "Secretary", "LoanOfficer"].includes(role)) {
    redirect("/dashboard/members");
  }

  return (
    <>
      <PageHeader
        title="New member"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Members", href: "/dashboard/members" },
          { label: "New" },
        ]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role: role!,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load the registration form">
          <Suspense fallback={<Skeleton className="h-[600px] w-full max-w-3xl rounded-lg" />}>
            <MemberRegistrationForm />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
