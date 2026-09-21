import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const search = searchParams.get("search")?.trim() ?? "";
  const cacheKey = `tag:${tags.loanProducts}:${page}:${limit}:${search}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where = search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {};

      const [data, total] = await Promise.all([
        db.loanProduct.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: "asc" },
        }),
        db.loanProduct.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    60
  );

  return NextResponse.json(result);
}

// Creating a loan product directly here was retired in favor of maker-
// checker: POST /api/loan-product-change-requests (with no targetProductId)
// proposes a new product, and a different SuperAdmin/Manager must approve it
// via .../[id]/approve before it actually exists — closing the previous gap
// where a product could be created with zero audit trail and no review.
