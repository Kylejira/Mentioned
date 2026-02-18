"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth"

export type PlanType = "free" | "starter" | "pro"
export type BillingPeriod = "monthly" | "annual" | null

export interface SubscriptionState {
  isLoading: boolean
  plan: PlanType
  billingPeriod: BillingPeriod
  isSubscribed: boolean // starter or pro
  isPro: boolean
  canScan: boolean
  scansRemaining: number | null // null = unlimited
  scansLimit: number | null
  scansUsed: number
  nextResetDate: string | null
  freeScanUsed: boolean
  cancelAtPeriodEnd?: boolean
  refresh: () => Promise<void>
  markFreeScanUsed: () => Promise<void>
  incrementScanCount: () => Promise<void>
}

const PRO_WHITELIST = (process.env.NEXT_PUBLIC_PRO_WHITELIST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)

/**
 * Hook to manage subscription state and feature gating
 */
export function useSubscription(): SubscriptionState {
  const { user } = useAuth()
  const [state, setState] = useState<Omit<SubscriptionState, "refresh" | "markFreeScanUsed" | "incrementScanCount">>({
    isLoading: true,
    plan: "free",
    billingPeriod: null,
    isSubscribed: false,
    isPro: false,
    canScan: true,
    scansRemaining: 1,
    scansLimit: 1,
    scansUsed: 0,
    nextResetDate: null,
    freeScanUsed: false,
  })

  const fetchSubscriptionStatus = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, isLoading: false }))
      return
    }

    // Check if user email is in the Pro whitelist (client-side check for instant response)
    const userEmail = user.email?.toLowerCase()
    if (userEmail && PRO_WHITELIST.includes(userEmail)) {
      setState({
        isLoading: false,
        plan: "pro",
        billingPeriod: null,
        isSubscribed: true,
        isPro: true,
        canScan: true,
        scansRemaining: null,
        scansLimit: null,
        scansUsed: 0,
        nextResetDate: null,
        freeScanUsed: false,
      })
      return
    }

    try {
      const response = await fetch("/api/subscription")
      if (response.ok) {
        const data = await response.json()
        setState({
          isLoading: false,
          plan: data.plan || "free",
          billingPeriod: data.billingPeriod || null,
          isSubscribed: data.isSubscribed || false,
          isPro: data.isPro || false,
          canScan: data.canScan ?? true,
          scansRemaining: data.scansRemaining,
          scansLimit: data.scansLimit,
          scansUsed: data.scansUsed || 0,
          nextResetDate: data.nextResetDate || null,
          freeScanUsed: data.freeScanUsed || false,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        })
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      console.error("Error fetching subscription:", error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [user])

  const markFreeScanUsed = useCallback(async () => {
    if (!user) return

    try {
      // This is handled by the scan API, but update local state
      setState(prev => ({
        ...prev,
        freeScanUsed: true,
        canScan: prev.isSubscribed, // Can only scan again if subscribed
        scansRemaining: prev.isSubscribed ? prev.scansRemaining : 0,
        scansUsed: prev.scansUsed + 1,
      }))
    } catch (err) {
      console.error("Error marking free scan used:", err)
    }
  }, [user])

  const incrementScanCount = useCallback(async () => {
    setState(prev => {
      const newUsed = prev.scansUsed + 1
      const newRemaining = prev.scansLimit ? Math.max(0, prev.scansLimit - newUsed) : null
      return {
        ...prev,
        scansUsed: newUsed,
        scansRemaining: newRemaining,
        canScan: newRemaining === null || newRemaining > 0,
      }
    })
  }, [])

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [fetchSubscriptionStatus])

  return {
    ...state,
    refresh: fetchSubscriptionStatus,
    markFreeScanUsed,
    incrementScanCount,
  }
}

/**
 * Check if user needs to upgrade for a feature
 */
export function getUpgradeReason(
  feature: "scan" | "generate" | "checklist" | "history",
  subscription: SubscriptionState
): string | null {
  if (subscription.isLoading) return null

  if (feature === "scan") {
    if (!subscription.canScan) {
      if (subscription.plan === "free" && subscription.freeScanUsed) {
        return "You've used your free scan. Upgrade to run more scans."
      }
      if (subscription.plan === "starter" && subscription.scansRemaining === 0) {
        return `You've used all ${subscription.scansLimit} scans this month. Upgrade to Pro for unlimited scans.`
      }
    }
  }
  
  if (feature === "generate" && subscription.plan === "free") {
    return "Upgrade to generate content drafts with AI."
  }
  
  if (feature === "checklist" && subscription.plan === "free") {
    return "Upgrade to access the AI Visibility Checklist."
  }
  
  if (feature === "history" && subscription.plan === "free") {
    return "Upgrade to access your scan history."
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
      "1 AI visibility scan",
      "View your visibility score",
      "See AI recommendations",
      "Basic competitor comparison",
    ],
    limitations: [
      "No additional scans",
      "No AI Visibility Checklist",
      "No content generation",
    ],
    cta: "Current Plan",
    popular: false,
  },
  starter: {
    name: "Starter",
    price: 19,
    priceLabel: "$19",
    period: "per month",
    scansIncluded: 10,
    features: [
      "10 AI visibility scans/month",
      "AI Visibility Checklist",
      "Generate optimization drafts",
      "Full scan history",
      "Competitor analysis",
      "Action recommendations",
    ],
    limitations: [],
    cta: "Get Started",
    popular: false,
  },
  pro_monthly: {
    name: "Pro",
    price: 37,
    priceLabel: "$37",
    period: "per month",
    features: [
      "Unlimited AI visibility scans",
      "AI Visibility Checklist",
      "Generate optimization drafts",
      "Full scan history",
      "Competitor analysis",
      "Action recommendations",
      "Priority support",
    ],
    limitations: [],
    cta: "Go Pro",
    popular: true,
  },
  pro_annual: {
    name: "Pro",
    price: 299,
    priceLabel: "$299",
    monthlyEquivalent: "$25",
    period: "per year",
    savings: "Save 33%",
    features: [
      "Unlimited AI visibility scans",
      "AI Visibility Checklist",
      "Generate optimization drafts",
      "Full scan history",
      "Competitor analysis",
      "Action recommendations",
      "Priority support",
    ],
    limitations: [],
    cta: "Go Pro",
    popular: true,
  },
} as const

// Stripe price IDs (set in environment variables)
export const STRIPE_PRICES = {
  starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
  pro_monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
  pro_annual: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
}
