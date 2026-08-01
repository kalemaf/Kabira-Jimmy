import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { MembersClient } from "@/components/dashboard/members/members-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function MembersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";
  const canCreate = ["SuperAdmin", "Manager", "Secretary", "LoanOfficer"].includes(role);

  return (
    <>
      <PageHeader
        title="Members"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Members" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
        actions={
          canCreate ? (
            <Button
              render={<Link href="/dashboard/members/new" />}
              nativeButton={false}
              className="hidden gap-1.5 sm:flex"
            >
              <Plus className="size-4" />
              New member
            </Button>
          ) : undefined
        }
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load members">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <MembersClient canCreate={canCreate} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
