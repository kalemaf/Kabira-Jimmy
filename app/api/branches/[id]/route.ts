import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { invalidateTag, tags } from "@/lib/cache";
import { branchSchema } from "@/lib/schemas/branch";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = branchSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const branch = await db.branch.update({ where: { id }, data: parsed.data });
  await invalidateTag(tags.branches);
  return NextResponse.json(branch);
}
