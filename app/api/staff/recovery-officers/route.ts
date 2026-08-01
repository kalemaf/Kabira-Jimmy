import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

// Scoped down from /api/staff (SuperAdmin-only, full staff fields) so
// Managers and Recovery Officers can populate an assignment dropdown
// without needing full staff-management access.
export async function GET() {
  const { error } = await requireRole(["SuperAdmin", "Manager", "RecoveryOfficer"]);
  if (error) return error;

  const officers = await getCachedOrFetch(
    `tag:${tags.staff}:recovery-officers`,
    () =>
      db.user.findMany({
        where: { role: "RecoveryOfficer" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    60
  );

  return NextResponse.json({ data: officers });
}
