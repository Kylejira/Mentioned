import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import Stripe from "stripe"

// Initialize Stripe lazily
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ 
        plan: "free",
        isSubscribed: false,
        isPro: false,
        canScan: true,
        scansRemaining: 1,
        scansLimit: 1,
        scansUsed: 0,
        freeScanUsed: false,
      })
    }

    // Check whitelist first
    const PRO_WHITELIST = ["kylejira@gmail.com"]
    if (PRO_WHITELIST.includes(user.email?.toLowerCase() || "")) {
      return NextResponse.json({
        plan: "pro",
        billingPeriod: null,
        isSubscribed: true,
        isPro: true,
        canScan: true,
        scansRemaining: null, // unlimited
        scansLimit: null,
        scansUsed: 0,
        nextResetDate: null,
        isWhitelisted: true,
      })
    }

    // Get subscription from database
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    // Get brand for free_scan_used
    const { data: brand } = await supabase
      .from("brands")
      .select("free_scan_used")
      .eq("user_id", user.id)
      .single()

    const freeScanUsed = brand?.free_scan_used || false

    if (!subscription) {
      // Free tier
      return NextResponse.json({
        plan: "free",
        billingPeriod: null,
        isSubscribed: false,
        isPro: false,
        canScan: !freeScanUsed,
        scansRemaining: freeScanUsed ? 0 : 1,
        scansLimit: 1,
        scansUsed: freeScanUsed ? 1 : 0,
        nextResetDate: null,
        freeScanUsed,
      })
    }

    // Paid subscription
    const isPro = subscription.plan === "pro_monthly" || subscription.plan === "pro_annual"
    const isStarter = subscription.plan === "starter"
    const billingPeriod = subscription.plan === "pro_annual" ? "annual" : "monthly"

    let canScan = true
    let scansRemaining: number | null = null

    if (isStarter) {
      const limit = subscription.scans_limit || 10
      const used = subscription.scans_used_this_period || 0
      scansRemaining = Math.max(0, limit - used)
      canScan = scansRemaining > 0
    }

    return NextResponse.json({
      plan: isPro ? "pro" : "starter",
      billingPeriod,
      isSubscribed: true,
      isPro,
      canScan,
      scansRemaining: isPro ? null : scansRemaining,
      scansLimit: isPro ? null : (subscription.scans_limit || 10),
      scansUsed: subscription.scans_used_this_period || 0,
      nextResetDate: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: subscription.stripe_customer_id,
    })
  } catch (error) {
    console.error("Subscription API error:", error)
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
  }
}

// Create portal session for managing subscription
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single()

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 })
    }

    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://mentioned.pro"}/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Portal session error:", error)
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 })
  }
}
