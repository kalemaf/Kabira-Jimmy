import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, invalidateTag, tags } from "@/lib/cache";
import { createStaffSchema } from "@/lib/schemas/staff";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export async function GET(req: Request) {
  const { error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const search = searchParams.get("search")?.trim() ?? "";
  const cacheKey = `tag:${tags.staff}:${page}:${limit}:${search}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};

      const [data, total] = await Promise.all([
        db.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            branchId: true,
            emailVerified: true,
            createdAt: true,
            branch: { select: { id: true, name: true, code: true } },
            nationalIdNumber: true,
            idDocumentUrl: true,
            selfieUrl: true,
            district: true,
            subCounty: true,
            village: true,
            nextOfKinName: true,
            nextOfKinPhone: true,
          },
        }),
        db.user.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    30
  );

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole(["SuperAdmin"]);
  if (error) return error;

  const body = await req.json();
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "A staff account with this email already exists" }, { status: 409 });
  }

  const temporaryPassword = randomBytes(9).toString("base64url");

  const signUp = await auth.api.signUpEmail({
    body: { email: parsed.data.email, password: temporaryPassword, name: parsed.data.name },
  });

  const user = await db.user.update({
    where: { id: signUp.user.id },
    data: {
      role: parsed.data.role,
      branchId: parsed.data.branchId,
      phone: parsed.data.phone,
      nationalIdNumber: parsed.data.nationalIdNumber,
      idDocumentUrl: parsed.data.idDocumentUrl,
      selfieUrl: parsed.data.selfieUrl,
      district: parsed.data.district,
      subCounty: parsed.data.subCounty || null,
      village: parsed.data.village || null,
      nextOfKinName: parsed.data.nextOfKinName,
      nextOfKinPhone: parsed.data.nextOfKinPhone,
      emailVerified: true,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "staff.registered",
    entityType: "User",
    entityId: user.id,
    newValue: {
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      nationalIdNumber: user.nationalIdNumber,
      district: user.district,
    },
    request: req,
  });

  await invalidateTag(tags.staff);
  return NextResponse.json({ user, temporaryPassword }, { status: 201 });
}
