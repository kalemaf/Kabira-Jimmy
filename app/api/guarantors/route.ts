import { db } from "@/lib/db";
import { requireSession, requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { guarantorSchema } from "@/lib/schemas/guarantor";
import { enforceGuarantorLimits } from "@/lib/loan-eligibility";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const memberId = searchParams.get("memberId")?.trim() ?? "";
  const cacheKey = `tag:${tags.guarantors}:${page}:${limit}:${memberId}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where = memberId ? { memberId } : {};

      const [data, total] = await Promise.all([
        db.guarantor.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { member: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } },
        }),
        db.guarantor.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    30
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { error } = await requireRole(["SuperAdmin", "Manager", "Secretary", "LoanOfficer"]);
  if (error) return error;

  const body = await req.json();
  const parsed = guarantorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const guarantor = await db.guarantor.create({ data: parsed.data });
  await enforceGuarantorLimits([parsed.data.memberId]);
  await invalidateTag(tags.guarantors);
  return NextResponse.json(guarantor, { status: 201 });
}
