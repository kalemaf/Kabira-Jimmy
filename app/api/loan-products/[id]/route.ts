import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
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

// Editing a loan product directly here was retired in favor of maker-
// checker: POST /api/loan-product-change-requests (with this id as
// targetProductId) proposes the edit, and a different SuperAdmin/Manager
// must approve it via .../[id]/approve before it actually applies — closing
// the previous gap where interest rates/fees on a live product could change
// with zero audit trail and no review.
