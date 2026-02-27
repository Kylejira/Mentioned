import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import Stripe from "stripe"
import { log } from "@/lib/logger"

const logger = log.create("checkout-api")

// Initialize Stripe lazily to avoid build-time errors
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

// Price IDs from environment
function getPriceIds() {
  return {
    starter: process.env.STRIPE_STARTER_PRICE_ID!,
    pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    pro_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { plan } = await request.json()

    if (!plan) {
      return NextResponse.json({ error: "Missing plan" }, { status: 400 })
    }

    // Look up price ID from plan name (server-side)
    const priceIds = getPriceIds()
    const priceId = priceIds[plan as keyof typeof priceIds]

    if (!priceId) {
      logger.error("No price ID found for plan", { plan })
      logger.error("Available price IDs", { priceIds })
      return NextResponse.json({ error: `Invalid plan: ${plan}` }, { status: 400 })
    }

    // Check if user already has a Stripe customer ID
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single()

    let customerId = subscription?.stripe_customer_id

    const stripe = getStripe()
    
    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://mentioned.pro"}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://mentioned.pro"}/pricing?checkout=cancelled`,
      metadata: {
        user_id: user.id,
        plan: plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: plan,
        },
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    logger.error("Checkout error", { error: String(error) })
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
