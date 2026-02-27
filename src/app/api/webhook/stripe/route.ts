import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { log } from "@/lib/logger"

const logger = log.create("stripe-webhook")

// Initialize Stripe lazily
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

// Initialize Supabase admin client lazily
function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration is not available")
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Map plans to their scan limits
const PLAN_LIMITS: Record<string, number | null> = {
  starter: 10,
  pro_monthly: null, // unlimited
  pro_annual: null,  // unlimited
}

// Type for Stripe subscription data we need
interface StripeSubscriptionData {
  id: string
  status: string
  current_period_start: number
  current_period_end: number
  cancel_at_period_end: boolean
  metadata?: Record<string, string>
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")!
  const stripe = getStripe()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    logger.error("Webhook signature verification failed", { error: String(err) })
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  logger.info("Processing Stripe event", { eventType: event.type })

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        logger.info("Unhandled event type", { eventType: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error("Webhook processing error", { error: String(error) })
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id
  const plan = session.metadata?.plan
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!userId || !plan) {
    logger.error("Missing user_id or plan in session metadata")
    return
  }

  const stripe = getStripe()
  
  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as {
    id: string
    status: string
    current_period_start: number
    current_period_end: number
    cancel_at_period_end: boolean
    metadata?: Record<string, string>
  }

  // Upsert subscription record
  const { error } = await getSupabaseAdmin().from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    plan: plan,
    status: subscription.status,
    current_period_start: subscription.current_period_start 
      ? new Date(subscription.current_period_start * 1000).toISOString() 
      : new Date().toISOString(),
    current_period_end: subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString() 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    scans_used_this_period: 0,
    scans_limit: PLAN_LIMITS[plan] ?? null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
  }, {
    onConflict: "user_id",
  })

  if (error) {
    logger.error("Error upserting subscription", { error: String(error) })
    return
  }

  // Update brands table subscription status
  const subscriptionStatus = plan.startsWith("pro") ? "pro" : "starter"
  await getSupabaseAdmin()
    .from("brands")
    .update({ 
      subscription_status: subscriptionStatus,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    })
    .eq("user_id", userId)

  logger.info("Subscription activated for user", { userId, plan })
}

async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  const subscription = stripeSubscription as unknown as StripeSubscriptionData
  const userId = subscription.metadata?.user_id
  const plan = subscription.metadata?.plan

  if (!userId) {
    // Try to find user by stripe_subscription_id
    const { data: existingSub } = await getSupabaseAdmin()
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscription.id)
      .single()

    if (!existingSub) {
      logger.error("Could not find user for subscription", { subscriptionId: subscription.id })
      return
    }
  }

  const { error } = await getSupabaseAdmin()
    .from("subscriptions")
    .update({
      status: subscription.status,
      current_period_start: subscription.current_period_start 
        ? new Date(subscription.current_period_start * 1000).toISOString() 
        : undefined,
      current_period_end: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString() 
        : undefined,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      plan: plan || undefined,
      scans_limit: plan ? PLAN_LIMITS[plan] : undefined,
    })
    .eq("stripe_subscription_id", subscription.id)

  if (error) {
    logger.error("Error updating subscription", { error: String(error) })
  }

  // Update brands table status
  if (subscription.status === "active") {
    const subscriptionStatus = plan?.startsWith("pro") ? "pro" : "starter"
    await getSupabaseAdmin()
      .from("brands")
      .update({ subscription_status: subscriptionStatus })
      .eq("stripe_subscription_id", subscription.id)
  } else if (subscription.status === "past_due") {
    await getSupabaseAdmin()
      .from("brands")
      .update({ subscription_status: "past_due" })
      .eq("stripe_subscription_id", subscription.id)
  }

  logger.info("Subscription updated", { subscriptionId: subscription.id, status: subscription.status })
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const subscription = stripeSubscription as unknown as StripeSubscriptionData
  
  // Find user by subscription ID
  const { data: sub } = await getSupabaseAdmin()
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .single()

  if (!sub) {
    logger.error("Could not find subscription", { subscriptionId: subscription.id })
    return
  }

  // Update subscription status
  await getSupabaseAdmin()
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscription.id)

  // Revert to free in brands table
  await getSupabaseAdmin()
    .from("brands")
    .update({ 
      subscription_status: "free",
      stripe_subscription_id: null,
    })
    .eq("user_id", sub.user_id)

  logger.info("Subscription cancelled for user", { userId: sub.user_id })
}

async function handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
  // Cast to access subscription property
  const invoice = stripeInvoice as unknown as { 
    subscription: string | null
    billing_reason: string 
  }
  const subscriptionId = invoice.subscription

  if (!subscriptionId) return

  // Check if this is a renewal (not the first payment)
  if (invoice.billing_reason === "subscription_cycle") {
    // Reset scan count for new billing period
    const { error } = await getSupabaseAdmin()
      .from("subscriptions")
      .update({ 
        scans_used_this_period: 0,
        status: "active",
      })
      .eq("stripe_subscription_id", subscriptionId)

    if (error) {
      logger.error("Error resetting scan count", { error: String(error) })
    } else {
      logger.info("Scan count reset for subscription", { subscriptionId })
    }
  }
}

async function handlePaymentFailed(stripeInvoice: Stripe.Invoice) {
  // Cast to access subscription property
  const invoice = stripeInvoice as unknown as { subscription: string | null }
  const subscriptionId = invoice.subscription

  if (!subscriptionId) return

  await getSupabaseAdmin()
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId)

  // Also update brands table
  await getSupabaseAdmin()
    .from("brands")
    .update({ subscription_status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId)

  logger.info("Payment failed for subscription", { subscriptionId })
}
