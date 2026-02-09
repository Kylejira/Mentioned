"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useSubscription, PLANS } from "@/lib/subscription"
import { Check, Sparkles, Loader2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export default function PricingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const subscription = useSubscription()
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly")
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleSelectPlan = async (plan: "starter" | "pro_monthly" | "pro_annual") => {
    if (!user) {
      router.push("/signup?redirect=/pricing")
      return
    }

    setLoadingPlan(plan)

    try {
      const priceId = plan === "starter" 
        ? process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID
        : plan === "pro_annual"
          ? process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID
          : process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, plan }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || "Failed to create checkout session")
      }
    } catch (error) {
      console.error("Checkout error:", error)
      alert("Something went wrong. Please try again.")
    } finally {
      setLoadingPlan(null)
    }
  }

  const isCurrentPlan = (plan: string) => {
    if (plan === "free") return subscription.plan === "free"
    if (plan === "starter") return subscription.plan === "starter"
    if (plan === "pro_monthly" || plan === "pro_annual") return subscription.plan === "pro"
    return false
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1E293B] mb-3">
            Choose your plan
          </h1>
          <p className="text-[#64748B] text-lg max-w-xl mx-auto">
            Get discovered by AI. Start with a free scan, then upgrade to unlock all features.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              billingPeriod === "monthly"
                ? "bg-[#1E293B] text-white"
                : "text-[#64748B] hover:text-[#1E293B]"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod("annual")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              billingPeriod === "annual"
                ? "bg-[#1E293B] text-white"
                : "text-[#64748B] hover:text-[#1E293B]"
            )}
          >
            Annual
            <span className="text-xs bg-[#10B981] text-white px-2 py-0.5 rounded-full">
              Save 33%
            </span>
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-[#1E293B] mb-1">Free</h3>
              <p className="text-[#64748B] text-sm">Try it out</p>
            </div>
            
            <div className="mb-6">
              <span className="text-4xl font-bold text-[#1E293B]">$0</span>
              <span className="text-[#64748B] ml-1">forever</span>
            </div>

            <ul className="space-y-3 mb-8">
              {PLANS.free.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#10B981] mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
              {PLANS.free.limitations.map((limitation, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#9CA3AF]">
                  <span className="size-4 mt-0.5 shrink-0 text-center">—</span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>

            {isCurrentPlan("free") ? (
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            ) : (
              <Link href="/check">
                <Button variant="outline" className="w-full">
                  Get Started Free
                </Button>
              </Link>
            )}
          </div>

          {/* Starter Plan */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-[#1E293B] mb-1">Starter</h3>
              <p className="text-[#64748B] text-sm">For growing brands</p>
            </div>
            
            <div className="mb-6">
              <span className="text-4xl font-bold text-[#1E293B]">$19</span>
              <span className="text-[#64748B] ml-1">/month</span>
            </div>

            <ul className="space-y-3 mb-8">
              {PLANS.starter.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#10B981] mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isCurrentPlan("starter") ? (
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            ) : (
              <Button 
                className="w-full bg-[#1E293B] hover:bg-[#334155]"
                onClick={() => handleSelectPlan("starter")}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === "starter" ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : null}
                Get Started
              </Button>
            )}
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-2xl border-2 border-[#2563EB] p-6 sm:p-8 relative">
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-[#2563EB] text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="size-3" />
                Most Popular
              </span>
            </div>

            <div className="mb-6 mt-2">
              <h3 className="text-lg font-semibold text-[#1E293B] mb-1">Pro</h3>
              <p className="text-[#64748B] text-sm">For serious growth</p>
            </div>
            
            <div className="mb-6">
              {billingPeriod === "annual" ? (
                <>
                  <span className="text-4xl font-bold text-[#1E293B]">$299</span>
                  <span className="text-[#64748B] ml-1">/year</span>
                  <div className="text-sm text-[#10B981] mt-1">
                    $25/month · Save $145/year
                  </div>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-[#1E293B]">$37</span>
                  <span className="text-[#64748B] ml-1">/month</span>
                </>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {PLANS.pro_monthly.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#2563EB] mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isCurrentPlan("pro_monthly") || isCurrentPlan("pro_annual") ? (
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            ) : (
              <Button 
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
                onClick={() => handleSelectPlan(billingPeriod === "annual" ? "pro_annual" : "pro_monthly")}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === "pro_monthly" || loadingPlan === "pro_annual" ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : null}
                Go Pro
                <ArrowRight className="size-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        {/* FAQ or comparison */}
        <div className="mt-16 text-center">
          <h2 className="text-xl font-semibold text-[#1E293B] mb-4">
            Questions?
          </h2>
          <p className="text-[#64748B] mb-4">
            All plans include our full dashboard, competitor analysis, and action recommendations.
          </p>
          <p className="text-[#64748B]">
            Need help choosing? <a href="mailto:support@mentioned.pro" className="text-[#2563EB] hover:underline">Contact us</a>
          </p>
        </div>
      </div>
    </AppShell>
  )
}
