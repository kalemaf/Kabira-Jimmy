import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/dashboard/sidebar-context";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Masthead } from "@/components/dashboard/masthead";
import type { StaffRole } from "@/components/dashboard/nav-config";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    role: (session.user as { role?: StaffRole }).role ?? "LoanOfficer",
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen flex-col">
        <Masthead user={user} />
        <div className="flex min-h-0 flex-1 bg-(--bg-canvas)">
          <Sidebar user={user} />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
