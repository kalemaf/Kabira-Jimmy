import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { StaffRole } from "@/components/dashboard/nav-config";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

/**
 * Server-side role check for API routes. This is the real security
 * boundary — the sidebar only hides nav items it never blocks a request.
 */
export async function requireRole(role: StaffRole | StaffRole[]) {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };

  const allowed = Array.isArray(role) ? role : [role];
  const userRole = (session.user as { role?: StaffRole }).role;
  if (!userRole || !allowed.includes(userRole)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}
