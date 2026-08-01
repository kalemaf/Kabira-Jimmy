import { db } from "@/lib/db";

/**
 * Writes one AuditLog row. Every mutating action in the loan lifecycle
 * (application create, approval step, disbursement, repayment, ...) must
 * call this — it is not optional, per master_prompt.md's domain rules.
 */
export async function writeAuditLog(entry: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  request?: Request;
}) {
  const ipAddress = entry.request
    ? (entry.request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      entry.request.headers.get("x-real-ip") ??
      null)
    : null;
  const browser = entry.request?.headers.get("user-agent") ?? null;

  await db.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValue: entry.oldValue === undefined ? undefined : (entry.oldValue as object),
      newValue: entry.newValue === undefined ? undefined : (entry.newValue as object),
      ipAddress,
      browser,
    },
  });
}
