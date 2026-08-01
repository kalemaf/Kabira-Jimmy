import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Pool sizing for serverless (Vercel + Neon's pooled/PgBouncer endpoint):
// each function instance gets its OWN pool, and Vercel can run many
// instances concurrently — an unbounded default (pg's default max is 10)
// multiplies into hundreds of connections under load and can exhaust
// PgBouncer's client-connection limit. `max: 5` is small enough per
// instance to stay safe at scale, but still lets this app's common
// `Promise.all([db.x.findMany(...), db.x.count(...)])` list-query pattern
// run its two queries in parallel rather than serializing on a single slot.
//
// idleTimeoutMillis is deliberately short in production — short-lived
// function instances should release connections quickly. In dev, a single
// long-lived `next dev` process benefits from staying warm instead: a 10s
// idle timeout means any click more than 10s after the last one pays a full
// fresh TLS handshake + Neon cold-start (multiple seconds) before the query
// even starts. A dev process idling isn't holding PgBouncer's pool hostage
// the way dozens of serverless instances would, so it's safe to relax here.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: process.env.NODE_ENV === "production" ? 10_000 : 120_000,
});
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const db = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
export { db };
