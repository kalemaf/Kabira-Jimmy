import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { SavingsDetail } from "@/components/dashboard/savings/savings-detail";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function SavingsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role ?? "LoanOfficer";
  const canTransact = ["SuperAdmin", "Manager", "Cashier"].includes(role);
  const canConfirm = ["SuperAdmin", "Manager"].includes(role);

  return (
    <>
      <PageHeader
        title="Savings account"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Savings", href: "/dashboard/savings" },
          { label: "Detail" },
        ]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role,
        }}
      />
      <main className="flex-1 px-4 py-6 md:px-8">
        <SavingsDetail accountId={id} canTransact={canTransact} canConfirm={canConfirm} />
      </main>
    </>
  );
}
