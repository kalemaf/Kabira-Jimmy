import { redis } from "@/lib/cache";

/**
 * Better Auth's secondaryStorage adapter, backed by the same Upstash Redis
 * instance already used for app caching. Without this, Better Auth's rate
 * limiter defaults to in-memory counters — fine on a single long-running
 * process, but useless in production where multiple serverless instances
 * (or a redeploy) each start with a fresh, empty counter, silently
 * defeating brute-force protection on /auth/sign-in.
 *
 * Values are stored/read as plain strings — Better Auth JSON.stringifies
 * before calling `set` and JSON.parses what `get` returns, so no
 * serialization happens here.
 */
export const authRedisStorage = {
  async get(key: string): Promise<string | null> {
    const value = await redis.get<string>(key).catch(() => null);
    return value ?? null;
  },
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) await redis.set(key, value, { ex: ttl });
      else await redis.set(key, value);
    } catch {
      // Fail open — same convention as lib/cache.ts: a Redis outage should
      // degrade rate-limit precision, not take down the login page.
    }
  },
  async delete(key: string): Promise<void> {
    await redis.del(key).catch(() => {});
  },
};
