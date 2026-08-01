import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoanProductForm } from "@/components/dashboard/loan-products/loan-product-form";
import type { StaffRole } from "@/components/dashboard/nav-config";

export default async function EditLoanProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role;

  if (role !== "SuperAdmin" && role !== "Manager") {
    redirect("/dashboard/loan-products");
  }

  const { id } = await params;

  return (
    <>
      <PageHeader
        title="Edit loan product"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Loan Products", href: "/dashboard/loan-products" },
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
        <LoanProductForm productId={id} />
      </main>
    </>
  );
}
