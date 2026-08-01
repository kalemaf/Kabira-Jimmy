import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { branchSchema } from "@/lib/schemas/branch";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const search = searchParams.get("search")?.trim() ?? "";
  const cacheKey = `tag:${tags.branches}:${page}:${limit}:${search}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { code: { contains: search, mode: "insensitive" as const } },
              { district: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};

      const [data, total] = await Promise.all([
        db.branch.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: "asc" },
        }),
        db.branch.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    60
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { error } = await requireRole(["SuperAdmin", "Manager"]);
  if (error) return error;

  const body = await req.json();
  const parsed = branchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await db.branch.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: "A branch with this code already exists" }, { status: 409 });
  }

  const branch = await db.branch.create({ data: parsed.data });
  await invalidateTag(tags.branches);
  return NextResponse.json(branch, { status: 201 });
}
