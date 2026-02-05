"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth"
import { createClient, type SubscriptionStatus } from "@/lib/supabase"

// Pro access whitelist - emails that get automatic Pro access
const PRO_WHITELIST = [
  "kylejira@gmail.com",
]

export interface SubscriptionState {
  status: SubscriptionStatus
  freeScanUsed: boolean
  canRunScan: boolean
  canGenerateDrafts: boolean
  isLoading: boolean
  refresh: () => Promise<void>
  markFreeScanUsed: () => Promise<void>
}

/**
 * Hook to manage subscription state and feature gating
 */
export function useSubscription(): SubscriptionState {
  const { user } = useAuth()
  const [status, setStatus] = useState<SubscriptionStatus>("free")
  const [freeScanUsed, setFreeScanUsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchSubscriptionStatus = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    // Check if user email is in the Pro whitelist
    const userEmail = user.email?.toLowerCase()
    if (userEmail && PRO_WHITELIST.includes(userEmail)) {
      setStatus("pro")
      setFreeScanUsed(false)
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    if (!supabase) {
      // Demo mode - allow everything
      setStatus("pro")
      setFreeScanUsed(false)
      setIsLoading(false)
      return
    }

    try {
      const { data: brand, error } = await supabase
        .from("brands")
        .select("subscription_status, free_scan_used")
        .eq("user_id", user.id)
        .single()

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching subscription:", error)
      }

      if (brand) {
        setStatus(brand.subscription_status || "free")
        setFreeScanUsed(brand.free_scan_used || false)
      } else {
        // No brand yet - user is on free tier
        setStatus("free")
        setFreeScanUsed(false)
      }
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const markFreeScanUsed = useCallback(async () => {
    if (!user) return

    const supabase = createClient()
    if (!supabase) return

    try {
      await supabase
        .from("brands")
        .update({ free_scan_used: true })
        .eq("user_id", user.id)

      setFreeScanUsed(true)
    } catch (err) {
      console.error("Error marking free scan used:", err)
    }
  }, [user])

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [fetchSubscriptionStatus])

  // Calculate feature access
  const isPaid = status === "pro" || status === "enterprise"
  const canRunScan = isPaid || !freeScanUsed
  const canGenerateDrafts = isPaid

  return {
    status,
    freeScanUsed,
    canRunScan,
    canGenerateDrafts,
    isLoading,
    refresh: fetchSubscriptionStatus,
    markFreeScanUsed,
  }
}

/**
 * Check if user needs to upgrade for a feature
 */
export function getUpgradeReason(
  feature: "scan" | "generate",
  subscription: SubscriptionState
): string | null {
  if (feature === "scan" && !subscription.canRunScan) {
    return "You've used your free scan. Upgrade to run unlimited scans."
  }
  if (feature === "generate" && !subscription.canGenerateDrafts) {
    return "Upgrade to Pro to generate content drafts with AI."
  }
  return null
}

/**
 * Plan details for pricing page
 */
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceLabel: "$0",
    period: "forever",
    features: [
      "1 visibility scan",
      "See your AI visibility status",
      "Competitor comparison",
      "Visibility signals breakdown",
      "Basic action recommendations",
    ],
    limitations: [
      "No additional scans",
      "No AI-generated content drafts",
    ],
    cta: "Current Plan",
    popular: false,
  },
  pro: {
    name: "Pro",
    price: 29,
    priceLabel: "$29",
    period: "per month",
    features: [
      "Unlimited visibility scans",
      "AI-generated content drafts",
      "Comparison page templates",
      "FAQ content generator",
      "Homepage copy suggestions",
      "Track visibility over time",
      "Priority support",
    ],
    limitations: [],
    cta: "Upgrade to Pro",
    popular: true,
  },
  enterprise: {
    name: "Enterprise",
    price: 99,
    priceLabel: "$99",
    period: "per month",
    features: [
      "Everything in Pro",
      "Multiple brands",
      "Team access",
      "API access",
      "Custom integrations",
      "Dedicated support",
      "Custom reporting",
    ],
    limitations: [],
    cta: "Contact Sales",
    popular: false,
  },
} as const
