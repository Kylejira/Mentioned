import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Tests for scan quota enforcement logic.
 * Extracted from the scan API route's quota-checking behavior.
 */

interface QuotaCheckInput {
  hasSubscription: boolean
  plan: string | null
  scansUsed: number
  scansLimit: number
  freeScanUsed: boolean
  isWhitelisted: boolean
}

type QuotaResult =
  | { allowed: true; planTier: "free" | "pro" }
  | { allowed: false; reason: "upgrade_required" | "scan_limit_reached" }

function checkScanQuota(input: QuotaCheckInput): QuotaResult {
  if (input.isWhitelisted) {
    return { allowed: true, planTier: "pro" }
  }

  if (!input.hasSubscription) {
    if (input.freeScanUsed) {
      return { allowed: false, reason: "upgrade_required" }
    }
    return { allowed: true, planTier: "free" }
  }

  if (input.plan === "starter") {
    if (input.scansUsed >= input.scansLimit) {
      return { allowed: false, reason: "scan_limit_reached" }
    }
    return { allowed: true, planTier: "pro" }
  }

  if (input.plan === "pro_monthly" || input.plan === "pro_annual") {
    return { allowed: true, planTier: "pro" }
  }

  return { allowed: true, planTier: "free" }
}

describe("Scan Quota Enforcement", () => {
  it("allows first free scan", () => {
    const result = checkScanQuota({
      hasSubscription: false,
      plan: null,
      scansUsed: 0,
      scansLimit: 0,
      freeScanUsed: false,
      isWhitelisted: false,
    })
    expect(result).toEqual({ allowed: true, planTier: "free" })
  })

  it("blocks second free scan", () => {
    const result = checkScanQuota({
      hasSubscription: false,
      plan: null,
      scansUsed: 0,
      scansLimit: 0,
      freeScanUsed: true,
      isWhitelisted: false,
    })
    expect(result).toEqual({ allowed: false, reason: "upgrade_required" })
  })

  it("allows whitelisted users unlimited scans", () => {
    const result = checkScanQuota({
      hasSubscription: false,
      plan: null,
      scansUsed: 0,
      scansLimit: 0,
      freeScanUsed: true,
      isWhitelisted: true,
    })
    expect(result).toEqual({ allowed: true, planTier: "pro" })
  })

  it("allows starter plan under limit", () => {
    const result = checkScanQuota({
      hasSubscription: true,
      plan: "starter",
      scansUsed: 5,
      scansLimit: 10,
      freeScanUsed: true,
      isWhitelisted: false,
    })
    expect(result).toEqual({ allowed: true, planTier: "pro" })
  })

  it("blocks starter plan at limit", () => {
    const result = checkScanQuota({
      hasSubscription: true,
      plan: "starter",
      scansUsed: 10,
      scansLimit: 10,
      freeScanUsed: true,
      isWhitelisted: false,
    })
    expect(result).toEqual({ allowed: false, reason: "scan_limit_reached" })
  })

  it("blocks starter plan over limit", () => {
    const result = checkScanQuota({
      hasSubscription: true,
      plan: "starter",
      scansUsed: 15,
      scansLimit: 10,
      freeScanUsed: true,
      isWhitelisted: false,
    })
    expect(result).toEqual({ allowed: false, reason: "scan_limit_reached" })
  })

  it("allows pro monthly unlimited", () => {
    const result = checkScanQuota({
      hasSubscription: true,
      plan: "pro_monthly",
      scansUsed: 100,
      scansLimit: 0,
      freeScanUsed: true,
      isWhitelisted: false,
    })
    expect(result).toEqual({ allowed: true, planTier: "pro" })
  })

  it("allows pro annual unlimited", () => {
    const result = checkScanQuota({
      hasSubscription: true,
      plan: "pro_annual",
      scansUsed: 500,
      scansLimit: 0,
      freeScanUsed: true,
      isWhitelisted: false,
    })
    expect(result).toEqual({ allowed: true, planTier: "pro" })
  })
})
