import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"

// ─────────────────────────────────────────────────────────────────────
// IP extraction tests
// ─────────────────────────────────────────────────────────────────────

import { getClientIp, hashIp } from "@/lib/rate-limit/get-client-ip"

function reqWithHeaders(headers: Record<string, string>): NextRequest {
  // Minimal NextRequest stub that satisfies headers.get()
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest
}

describe("getClientIp", () => {
  it("prefers cf-connecting-ip when present", () => {
    const req = reqWithHeaders({
      "cf-connecting-ip": "1.2.3.4",
      "x-real-ip": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12",
    })
    expect(getClientIp(req)).toBe("1.2.3.4")
  })

  it("falls back to x-real-ip when cf-connecting-ip is missing", () => {
    const req = reqWithHeaders({
      "x-real-ip": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12",
    })
    expect(getClientIp(req)).toBe("5.6.7.8")
  })

  it("falls back to first entry in x-forwarded-for chain", () => {
    const req = reqWithHeaders({
      "x-forwarded-for": "1.2.3.4, 192.168.1.1, 10.0.0.1",
    })
    expect(getClientIp(req)).toBe("1.2.3.4")
  })

  it("returns null when no usable headers", () => {
    const req = reqWithHeaders({})
    expect(getClientIp(req)).toBeNull()
  })

  it("rejects 'unknown' sentinel value", () => {
    const req = reqWithHeaders({
      "x-real-ip": "unknown",
    })
    expect(getClientIp(req)).toBeNull()
  })

  it("accepts IPv6 addresses", () => {
    const req = reqWithHeaders({
      "cf-connecting-ip": "2001:db8::1",
    })
    expect(getClientIp(req)).toBe("2001:db8::1")
  })

  it("trims whitespace from x-forwarded-for entries", () => {
    const req = reqWithHeaders({
      "x-forwarded-for": "  1.2.3.4  , 5.6.7.8",
    })
    expect(getClientIp(req)).toBe("1.2.3.4")
  })
})

describe("hashIp", () => {
  it("produces deterministic SHA-256 hashes", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"))
  })

  it("produces a 64-char hex string", () => {
    const h = hashIp("1.2.3.4")
    expect(h).toMatch(/^[a-f0-9]{64}$/)
  })

  it("normalizes case and whitespace", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp(" 1.2.3.4 "))
    expect(hashIp("2001:DB8::1")).toBe(hashIp("2001:db8::1"))
  })

  it("produces different hashes for different IPs", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("1.2.3.5"))
  })
})

// ─────────────────────────────────────────────────────────────────────
// Rate limit logic tests (with mocked Redis)
// ─────────────────────────────────────────────────────────────────────

// In-memory mock of just the ioredis methods we use.
// Mirrors ZADD/ZREMRANGEBYSCORE/ZCARD/ZRANGE/EXPIRE semantics for sliding window.
class MockRedis {
  private store = new Map<string, Array<{ score: number; member: string }>>()
  private throwOnNext = false

  private get(key: string) {
    if (!this.store.has(key)) this.store.set(key, [])
    return this.store.get(key)!
  }

  setThrowOnNext() {
    this.throwOnNext = true
  }

  multi() {
    const ops: Array<() => unknown> = []
    return {
      zremrangebyscore: (key: string, min: number, max: number) => {
        ops.push(() => {
          const arr = this.get(key)
          const before = arr.length
          this.store.set(
            key,
            arr.filter((e) => !(e.score >= min && e.score <= max)),
          )
          return before - this.get(key).length
        })
        return this
      },
      zcard: (key: string) => {
        ops.push(() => this.get(key).length)
        return this
      },
      zadd: (key: string, score: number, member: string) => {
        ops.push(() => {
          this.get(key).push({ score, member })
          return 1
        })
        return this
      },
      expire: (key: string, _ttl: number) => {
        ops.push(() => 1)
        return this
      },
      exec: async () => {
        if (this.throwOnNext) {
          this.throwOnNext = false
          throw new Error("Simulated Redis failure")
        }
        return ops.map((op) => [null, op()])
      },
    }
  }

  async zrange(key: string, start: number, stop: number, withscores?: string) {
    const arr = [...this.get(key)].sort((a, b) => a.score - b.score)
    const slice = arr.slice(
      start,
      stop === -1 ? undefined : stop + 1,
    )
    if (withscores === "WITHSCORES") {
      const out: string[] = []
      for (const e of slice) {
        out.push(e.member, String(e.score))
      }
      return out
    }
    return slice.map((e) => e.member)
  }

  reset() {
    this.store.clear()
    this.throwOnNext = false
  }
}

const mockRedis = new MockRedis()

vi.mock("@/lib/queue/connection", () => ({
  getRedisConnection: () => mockRedis,
}))

// Import after mocks are registered
import {
  checkPublicScanRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit/public-scan-limit"

describe("checkPublicScanRateLimit", () => {
  const originalRedisUrl = process.env.REDIS_URL

  beforeEach(() => {
    mockRedis.reset()
    process.env.REDIS_URL = "redis://mocked"
  })

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = originalRedisUrl
    }
  })

  it("fails open with allowed=true when REDIS_URL is unset", async () => {
    delete process.env.REDIS_URL
    const result = await checkPublicScanRateLimit("1.2.3.4")
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(3)
    expect(result.remaining).toBe(3)
  })

  it("fails open when Redis throws", async () => {
    mockRedis.setThrowOnNext()
    const result = await checkPublicScanRateLimit("1.2.3.4")
    expect(result.allowed).toBe(true)
  })

  it("allows 3 requests then blocks the 4th from same IP", async () => {
    const ip = "1.2.3.4"
    const r1 = await checkPublicScanRateLimit(ip)
    const r2 = await checkPublicScanRateLimit(ip)
    const r3 = await checkPublicScanRateLimit(ip)
    const r4 = await checkPublicScanRateLimit(ip)

    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(2)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(1)
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)
    expect(r4.allowed).toBe(false)
    expect(r4.remaining).toBe(0)
    expect(r4.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("scopes the limit per IP", async () => {
    // Three from IP A → allowed
    await checkPublicScanRateLimit("1.1.1.1")
    await checkPublicScanRateLimit("1.1.1.1")
    await checkPublicScanRateLimit("1.1.1.1")
    const blocked = await checkPublicScanRateLimit("1.1.1.1")
    expect(blocked.allowed).toBe(false)

    // Different IP starts fresh
    const otherIp = await checkPublicScanRateLimit("2.2.2.2")
    expect(otherIp.allowed).toBe(true)
    expect(otherIp.remaining).toBe(2)
  })

  it("respects custom limit option", async () => {
    const ip = "9.9.9.9"
    const r1 = await checkPublicScanRateLimit(ip, { limit: 1 })
    const r2 = await checkPublicScanRateLimit(ip, { limit: 1 })
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(0)
    expect(r2.allowed).toBe(false)
  })

  it("returns resetAt as a future unix-ms timestamp when blocked", async () => {
    const ip = "8.8.8.8"
    await checkPublicScanRateLimit(ip)
    await checkPublicScanRateLimit(ip)
    await checkPublicScanRateLimit(ip)
    const blocked = await checkPublicScanRateLimit(ip)
    expect(blocked.resetAt).toBeGreaterThan(Date.now())
  })
})

// ─────────────────────────────────────────────────────────────────────
// Header generation
// ─────────────────────────────────────────────────────────────────────

describe("rateLimitHeaders", () => {
  it("emits X-RateLimit-* headers for an allowed result", () => {
    const headers = rateLimitHeaders({
      allowed: true,
      limit: 3,
      remaining: 2,
      resetAt: 1700000000000,
      retryAfterSeconds: 0,
    })
    expect(headers["X-RateLimit-Limit"]).toBe("3")
    expect(headers["X-RateLimit-Remaining"]).toBe("2")
    expect(headers["X-RateLimit-Reset"]).toBe("1700000000")
    expect(headers["Retry-After"]).toBeUndefined()
  })

  it("includes Retry-After only when blocked", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      limit: 3,
      remaining: 0,
      resetAt: Date.now() + 60000,
      retryAfterSeconds: 60,
    })
    expect(headers["Retry-After"]).toBe("60")
  })
})
