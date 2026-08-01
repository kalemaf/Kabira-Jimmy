import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { ApplicationsQueueClient } from "@/components/dashboard/loan-applications/applications-queue-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffRole } from "@/components/dashboard/nav-config";
import type { ApplicationStatus } from "@/lib/loan-workflow";

const ROLE_QUEUE: Partial<Record<StaffRole, { status: ApplicationStatus | ApplicationStatus[]; description: string }>> = {
  Secretary: { status: "PendingSecretary", description: "Applications awaiting your first-line review." },
  Treasurer: { status: "PendingTreasurer", description: "Applications awaiting your financial check." },
  Manager: { status: "PendingManager", description: "Applications awaiting your final approval." },
  // Loan Officers both vet member self-service submissions AND handle
  // disbursement — two distinct responsibilities, one combined queue.
  LoanOfficer: {
    status: ["PendingLoanOfficer", "PendingDisbursement"],
    description: "Member-submitted applications awaiting your review, and approved applications awaiting disbursement.",
  },
  Cashier: { status: "PendingDisbursement", description: "Approved applications awaiting disbursement." },
};

export default async function LoanApplicationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";
  const canCreate = ["SuperAdmin", "Manager", "Secretary", "LoanOfficer"].includes(role);

  const queue = role === "SuperAdmin" || role === "Auditor" || role === "AccountsOfficer" || role === "RecoveryOfficer"
    ? undefined
    : ROLE_QUEUE[role];

  return (
    <>
      <PageHeader
        title="Loan Applications"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Applications" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <ErrorBoundary fallbackTitle="Couldn't load applications">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
            <ApplicationsQueueClient
              scopedStatus={queue?.status}
              title={queue?.description ?? "All loan applications in the SACCO."}
              canCreate={canCreate}
            />
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
