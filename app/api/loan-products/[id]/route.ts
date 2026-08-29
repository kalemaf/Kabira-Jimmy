import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { loanProductSchema } from "@/lib/schemas/loan-product";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const cacheKey = `tag:${tags.loanProducts}:detail:${id}`;

  const product = await getCachedOrFetch(cacheKey, () => db.loanProduct.findUnique({ where: { id } }), 60);

  if (!product) return NextResponse.json({ error: "Loan product not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = loanProductSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const product = await db.loanProduct.update({ where: { id }, data: parsed.data });
  await invalidateTag(tags.loanProducts);
  return NextResponse.json(product);
}
