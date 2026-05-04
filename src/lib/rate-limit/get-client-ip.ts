import { NextRequest } from "next/server"
import crypto from "crypto"

/**
 * Extract the best-effort client IP from a Next.js request.
 *
 * Header precedence (most-trusted first):
 *   1. cf-connecting-ip   — Cloudflare's authoritative client IP
 *   2. x-real-ip          — Set by some reverse proxies (nginx, etc.)
 *   3. x-forwarded-for    — First entry in the comma-separated chain
 *
 * On Vercel, x-forwarded-for is the trusted source. We pick the FIRST IP in
 * the chain (the actual client) rather than any intermediary proxy.
 *
 * Returns null when no usable IP can be derived (e.g. some test environments).
 */
export function getClientIp(req: NextRequest): string | null {
  const headers = req.headers

  const cf = headers.get("cf-connecting-ip")
  if (cf && isValidIp(cf)) return cf.trim()

  const real = headers.get("x-real-ip")
  if (real && isValidIp(real)) return real.trim()

  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first && isValidIp(first)) return first
  }

  return null
}

/**
 * Hash an IP address with SHA-256 for storage / dedup.
 * Used so we never persist raw IPs (GDPR-friendlier) while still being able to
 * de-dup waitlist entries from the same IP.
 */
export function hashIp(ip: string): string {
  return crypto
    .createHash("sha256")
    .update(ip.toLowerCase().trim())
    .digest("hex")
}

/**
 * Quick sanity check — accepts both IPv4 and IPv6 shapes. Doesn't try to be
 * a full RFC validator, just rejects obvious junk like empty / localhost-only
 * / "unknown".
 */
function isValidIp(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (v === "unknown") return false
  // Common dev/test sentinels — still valid IPs but we skip them so local
  // testing doesn't accidentally rate-limit.
  if (v === "127.0.0.1" || v === "::1") return true
  // IPv4: 4 dotted octets
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return true
  // IPv6: contains colons (loose check, sufficient for our purposes)
  if (v.includes(":")) return true
  return false
}
