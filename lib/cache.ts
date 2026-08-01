import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Known cache tags — one per entity domain. Route handlers cache under
// `tag:<tags.x>:...` keys; invalidateTag drops every key under that prefix.
export const tags = {
  branches: "branches",
  staff: "staff",
  members: "members",
  memberDocuments: "member-documents",
  loanProducts: "loan-products",
  guarantors: "guarantors",
  collateral: "collateral",
  loanApplications: "loan-applications",
  loans: "loans",
  repayments: "repayments",
  savings: "savings",
  ledger: "ledger",
  recovery: "recovery",
  notifications: "notifications",
  auditLog: "audit-log",
} as const;

let hasWarnedNoRedis = false;
function warnOnce() {
  if (hasWarnedNoRedis) return;
  hasWarnedNoRedis = true;
  console.warn(
    "[cache] UPSTASH_REDIS_URL/TOKEN not set — serving uncached. Set them in .env.local for production."
  );
}

/**
 * Reads `key` from Redis; on a miss, runs `fetcher` and stores the result
 * for `ttlSeconds`. Cache keys should be namespaced `tag:<tags.x>:...` so
 * `invalidateTag` can find them.
 *
 * Fails open: if Redis is unreachable or unconfigured, this falls back to
 * calling `fetcher` directly rather than 500ing the route — a cache outage
 * should degrade performance, not break the app.
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60
): Promise<T> {
  const cached = await redis.get<T>(key).catch(() => {
    warnOnce();
    return null;
  });
  if (cached !== null && cached !== undefined) return cached;

  const fresh = await fetcher();
  redis.set(key, fresh, { ex: ttlSeconds }).catch(() => warnOnce());
  return fresh;
}

/** Drops every cached key namespaced under `tag:<tag>:*`. Fails open. */
export async function invalidateTag(tag: string): Promise<void> {
  try {
    const keys = await redis.keys(`tag:${tag}:*`);
    if (keys.length === 0) return;
    await Promise.all(keys.map((key) => redis.del(key)));
  } catch {
    warnOnce();
  }
}

export { redis };
