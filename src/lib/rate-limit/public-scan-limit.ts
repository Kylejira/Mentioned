import { hashIp } from "./get-client-ip"
import { log } from "@/lib/logger"

const logger = log.create("public-scan-rate-limit")

/**
 * Sliding-window rate limit for anonymous public scans.
 *
 * Implementation: Redis sorted set per IP, scored by request timestamp (ms).
 *   - ZREMRANGEBYSCORE removes entries older than the window
 *   - ZCARD counts active entries
 *   - ZADD inserts the new request only if under the limit
 *   - EXPIRE keeps the key small even for inactive IPs
 *
 * Atomicity: we run the trim + count in one MULTI, then conditionally write.
 * The check-then-write race is intentional and acceptable here — at the IP
 * level a 1-2 extra scan slip on burst traffic is not a real problem.
 */

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number // unix ms
  retryAfterSeconds: number
}

const DEFAULT_LIMIT = 3
const DEFAULT_WINDOW_SECONDS = 24 * 60 * 60 // 24h

/**
 * Check (and consume on success) the public-scan rate limit for a given IP.
 *
 * Fail-open semantics:
 *   - If REDIS_URL is unset or Redis is unreachable, returns { allowed: true }
 *     with a logged warning. This keeps dev/test environments unblocked.
 *   - Production should always have REDIS_URL set (BullMQ depends on it).
 */
export async function checkPublicScanRateLimit(
  ip: string,
  options: { limit?: number; windowSeconds?: number } = {},
): Promise<RateLimitResult> {
  const limit = options.limit ?? DEFAULT_LIMIT
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS
  const windowMs = windowSeconds * 1000
  const now = Date.now()
  const windowStart = now - windowMs

  // No REDIS_URL → fail open with warning. Production must have this set.
  if (!process.env.REDIS_URL) {
    logger.warn(
      "REDIS_URL not set — rate limit disabled (DEV ONLY; production must have Redis)",
    )
    return failOpen(limit, now, windowMs)
  }

  let redis
  try {
    const { getRedisConnection } = await import("@/lib/queue/connection")
    redis = getRedisConnection()
  } catch (err) {
    logger.error("Failed to obtain Redis connection — failing open", {
      error: err instanceof Error ? err.message : String(err),
    })
    return failOpen(limit, now, windowMs)
  }

  const key = `public_scan_rl:${hashIp(ip)}`

  try {
    // 1) Trim + count in a single round-trip
    const trimAndCount = redis.multi()
    trimAndCount.zremrangebyscore(key, 0, windowStart)
    trimAndCount.zcard(key)
    const results = await trimAndCount.exec()
    if (!results) throw new Error("Redis MULTI returned null")
    const count = (results[1]?.[1] as number) || 0

    // 2) Over the limit → compute resetAt from oldest entry
    if (count >= limit) {
      const oldest = await redis.zrange(key, 0, 0, "WITHSCORES")
      const oldestScore =
        oldest && oldest.length === 2 ? Number(oldest[1]) : now
      const resetAt = oldestScore + windowMs
      const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000))
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: retryAfter,
      }
    }

    // 3) Under the limit → record this request
    const writePipeline = redis.multi()
    writePipeline.zadd(key, now, `${now}-${Math.random().toString(36).slice(2, 8)}`)
    writePipeline.expire(key, windowSeconds + 60)
    await writePipeline.exec()

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - count - 1),
      resetAt: now + windowMs,
      retryAfterSeconds: 0,
    }
  } catch (err) {
    logger.error("Rate limit check failed — failing open", {
      error: err instanceof Error ? err.message : String(err),
    })
    return failOpen(limit, now, windowMs)
  }
}

function failOpen(limit: number, now: number, windowMs: number): RateLimitResult {
  return {
    allowed: true,
    limit,
    remaining: limit,
    resetAt: now + windowMs,
    retryAfterSeconds: 0,
  }
}

/**
 * Build the headers object for any public-scan response (success or 429).
 * Always include X-RateLimit-* headers so clients can debug.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  }
  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds)
  }
  return headers
}
