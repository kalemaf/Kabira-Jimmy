import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { MemberForm } from "@/components/dashboard/members/member-registration-form";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role;

  if (!role || !["SuperAdmin", "Manager", "Secretary", "LoanOfficer"].includes(role)) {
    redirect(`/dashboard/members/${id}`);
  }

  return (
    <>
      <PageHeader
        title="Edit member"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Members", href: "/dashboard/members" },
          { label: "Edit" },
        ]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role: role!,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load the member">
          <Suspense fallback={<Skeleton className="h-[600px] w-full max-w-3xl rounded-lg" />}>
            <MemberForm memberId={id} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
