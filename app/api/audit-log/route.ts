import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { getCachedOrFetch, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function GET(req: Request) {
  const { error } = await requireRole(["SuperAdmin", "Auditor"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const userId = searchParams.get("userId")?.trim() ?? "";
  const action = searchParams.get("action")?.trim() ?? "";
  const entityType = searchParams.get("entityType")?.trim() ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cacheKey = `tag:${tags.auditLog}:${page}:${limit}:${userId}:${action}:${entityType}:${from}:${to}`;

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      const where: Prisma.AuditLogWhereInput = {
        ...(userId ? { userId } : {}),
        ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
        ...(entityType ? { entityType } : {}),
        ...(from || to
          ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      };

      const [data, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        }),
        db.auditLog.count({ where }),
      ]);

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    },
    20
  );

  return NextResponse.json(result);
}
