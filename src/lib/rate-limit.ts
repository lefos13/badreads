import { sql } from "drizzle-orm";
import { db } from "@/src/db";
import { rateLimitBuckets } from "@/src/db/schema";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type MemoryBucket = { count: number; windowStartedAt: number };

/*
 * The database branch makes limits survive across server instances when Neon
 * is configured. The small memory branch keeps local demos deterministic and
 * provides the same contract for tests without pretending a process-local map
 * is sufficient protection for a multi-instance deployment.
 */

const globalRateLimitState = globalThis as typeof globalThis & { __badreadsRateLimits?: Map<string, MemoryBucket> };
const memoryBuckets = globalRateLimitState.__badreadsRateLimits ?? new Map<string, MemoryBucket>();
globalRateLimitState.__badreadsRateLimits = memoryBuckets;

function consumeMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  const bucket = !current || now - current.windowStartedAt >= windowMs
    ? { count: 1, windowStartedAt: now }
    : { count: current.count + 1, windowStartedAt: current.windowStartedAt };
  memoryBuckets.set(key, bucket);
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStartedAt + windowMs - now) / 1000));
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds };
}

export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!db) return consumeMemory(key, limit, windowMs);

  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  await db.insert(rateLimitBuckets).values({ key, count: 1, windowStartedAt: now }).onConflictDoUpdate({
    target: rateLimitBuckets.key,
    set: {
      count: sql`CASE WHEN ${rateLimitBuckets.windowStartedAt} <= ${cutoff.toISOString()}::timestamptz THEN 1 ELSE ${rateLimitBuckets.count} + 1 END`,
      windowStartedAt: sql`CASE WHEN ${rateLimitBuckets.windowStartedAt} <= ${cutoff.toISOString()}::timestamptz THEN ${now.toISOString()}::timestamptz ELSE ${rateLimitBuckets.windowStartedAt} END`,
    },
  });
  const [bucket] = await db.select().from(rateLimitBuckets).where(sql`${rateLimitBuckets.key} = ${key}`).limit(1);
  if (!bucket) return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStartedAt.getTime() + windowMs - now.getTime()) / 1000));
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds };
}

export async function resetRateLimits() {
  memoryBuckets.clear();
  if (db) {
    await db.delete(rateLimitBuckets);
  }
}
