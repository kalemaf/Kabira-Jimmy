import { db } from "@/lib/db";
import { r2Client } from "@/lib/r2Client";
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { writeAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { gzipSync } from "node:zlib";

// Daily application-level backup (Vercel Cron — see vercel.json). Neon's own
// point-in-time recovery is the primary safety net for this database, but
// that lives entirely in Neon's infrastructure and isn't something this
// codebase can inspect or configure. This is a second, independent copy —
// every row of every table, as JSON, stored in R2 under a bucket this app
// already controls — so a full data export exists even if something goes
// wrong with the Neon project itself (wrong account, billing lapse, etc.).
//
// Runs via plain Prisma/pg queries rather than shelling out to `pg_dump`,
// since Vercel's serverless runtime doesn't ship that binary. This captures
// every row of every table but not DDL (schema, indexes, sequences) — schema
// is already fully reproducible from prisma/schema.prisma + `db push`,
// so only the DATA needed its own backup path.
const RETENTION_DAYS = 30;
const BACKUP_PREFIX = "backups/";

async function listTables(): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  return rows.map((r) => r.tablename);
}

async function pruneOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
  const list = await r2Client.send(
    new ListObjectsV2Command({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!, Prefix: BACKUP_PREFIX })
  );
  const stale = (list.Contents ?? []).filter((obj) => obj.LastModified && obj.LastModified.getTime() < cutoff);
  for (const obj of stale) {
    if (!obj.Key) continue;
    await r2Client.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!, Key: obj.Key }));
  }
  return stale.length;
}

export async function GET(req: Request) {
  // Fail CLOSED — same convention as the penalty-engine cron: an unset
  // secret must reject every request, not silently run an unauthenticated
  // full database export.
  if (!process.env.CRON_SECRET) {
    console.error("[cron/backup] CRON_SECRET is not set — refusing all requests");
    return NextResponse.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.CLOUDFLARE_R2_BUCKET_NAME || !process.env.CLOUDFLARE_R2_ENDPOINT) {
    return NextResponse.json({ error: "R2 is not configured — cannot store backup" }, { status: 503 });
  }

  const startedAt = Date.now();
  const tables = await listTables();
  const dump: Record<string, unknown[]> = {};
  let totalRows = 0;

  for (const table of tables) {
    const rows = await db.$queryRawUnsafe<unknown[]>(`SELECT * FROM "${table}"`);
    dump[table] = rows;
    totalRows += rows.length;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `${BACKUP_PREFIX}backup-${timestamp}.json.gz`;
  const body = gzipSync(
    Buffer.from(
      JSON.stringify({ generatedAt: new Date().toISOString(), tableCount: tables.length, totalRows, tables: dump })
    )
  );

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
    })
  );

  const pruned = await pruneOldBackups();

  await writeAuditLog({
    userId: null,
    action: "system.database_backup",
    entityType: "System",
    entityId: "backup",
    newValue: { key, tableCount: tables.length, totalRows, sizeBytes: body.length, pruned },
  });

  return NextResponse.json({
    key,
    tableCount: tables.length,
    totalRows,
    sizeBytes: body.length,
    prunedOldBackups: pruned,
    durationMs: Date.now() - startedAt,
  });
}
