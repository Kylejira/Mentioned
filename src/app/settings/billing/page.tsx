"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useSubscription, PLANS } from "@/lib/subscription"
import { 
  ArrowLeft, 
  Check, 
  Loader2, 
  ExternalLink,
  CreditCard,
  Calendar,
  Infinity,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function BillingPage() {
  const { user } = useAuth()
  const subscription = useSubscription()
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true)
    
    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
      })
      
      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || "Failed to open billing portal")
      }
    } catch (error) {
      console.error("Portal error:", error)
      alert("Failed to open billing portal. Please try again.")
    } finally {
      setIsLoadingPortal(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const getPlanDetails = () => {
    if (subscription.plan === "pro") {
      return {
        name: "Pro",
        price: subscription.billingPeriod === "annual" ? "$299/year" : "$37/month",
        description: "Unlimited scans, all features",
      }
    }
    if (subscription.plan === "starter") {
      return {
        name: "Starter",
        price: "$19/month",
        description: "10 scans per month",
      }
    }
    return {
      name: "Free",
      price: "$0",
      description: "1 scan only",
    }
  }

  const planDetails = getPlanDetails()

  if (subscription.isLoading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="size-8 animate-spin text-gray-400" />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto py-8">
        {/* Back link */}
        <Link 
          href="/settings" 
          className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1E293B] mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to Settings
        </Link>

        <h1 className="text-2xl font-bold text-[#1E293B] mb-8">Billing & Subscription</h1>

        {/* Current Plan Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-[#64748B] uppercase tracking-wide mb-4">
            Current Plan
          </h2>
          
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-[#1E293B]">{planDetails.name}</h3>
              <p className="text-[#64748B] mt-1">{planDetails.description}</p>
              <p className="text-2xl font-bold text-[#1E293B] mt-3">{planDetails.price}</p>
            </div>
            
            {subscription.plan !== "free" && (
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-medium",
                subscription.cancelAtPeriodEnd 
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              )}>
                {subscription.cancelAtPeriodEnd ? "Canceling" : "Active"}
              </span>
            )}
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start gap-3">
              <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Your subscription will end on {formatDate(subscription.nextResetDate)}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  You'll lose access to premium features after this date.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Usage Card (for Starter plan) */}
        {subscription.plan === "starter" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-medium text-[#64748B] uppercase tracking-wide mb-4">
              Usage This Period
            </h2>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#1E293B] font-medium">Scans Used</span>
              <span className="text-[#1E293B] font-semibold">
                {subscription.scansUsed} / {subscription.scansLimit}
              </span>
            </div>
            
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  subscription.scansRemaining === 0 
                    ? "bg-red-500" 
                    : subscription.scansRemaining && subscription.scansRemaining <= 2 
                      ? "bg-amber-500" 
                      : "bg-[#2563EB]"
                )}
                style={{ 
                  width: `${((subscription.scansUsed) / (subscription.scansLimit || 10)) * 100}%` 
                }}
              />
            </div>
            
            <p className="text-sm text-[#64748B] mt-3">
              Resets on {formatDate(subscription.nextResetDate)}
            </p>
          </div>
        )}

        {/* Pro Plan - Unlimited indicator */}
        {subscription.plan === "pro" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-medium text-[#64748B] uppercase tracking-wide mb-4">
              Usage
            </h2>
            
            <div className="flex items-center gap-2 text-emerald-600">
              <Infinity className="size-5" />
              <span className="font-medium">Unlimited scans</span>
            </div>
          </div>
        )}

        {/* Billing Details */}
        {subscription.isSubscribed && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-medium text-[#64748B] uppercase tracking-wide mb-4">
              Billing Details
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Billing period</span>
                <span className="text-[#1E293B] font-medium capitalize">
                  {subscription.billingPeriod || "Monthly"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Next billing date</span>
                <span className="text-[#1E293B] font-medium">
                  {formatDate(subscription.nextResetDate)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {subscription.isSubscribed ? (
            <>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={handleManageSubscription}
                disabled={isLoadingPortal}
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="size-4" />
                  Manage Subscription
                </span>
                {isLoadingPortal ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ExternalLink className="size-4" />
                )}
              </Button>
              
              <p className="text-xs text-center text-[#9CA3AF]">
                Update payment method, change plan, or cancel subscription
              </p>
            </>
          ) : (
            <Link href="/pricing">
              <Button className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]">
                Upgrade to Pro
              </Button>
            </Link>
          )}
        </div>

        {/* Plan Comparison (for free users) */}
        {subscription.plan === "free" && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E293B] mb-4">
              Upgrade to unlock more
            </h2>
            
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Check className="size-5 text-[#2563EB] mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-[#1E293B]">More scans</p>
                  <p className="text-sm text-[#64748B]">
                    Run 10 scans/month (Starter) or unlimited (Pro)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="size-5 text-[#2563EB] mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-[#1E293B]">AI Visibility Checklist</p>
                  <p className="text-sm text-[#64748B]">
                    Step-by-step guide to improve your AI visibility
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="size-5 text-[#2563EB] mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-[#1E293B]">Content generation</p>
                  <p className="text-sm text-[#64748B]">
                    Generate comparison pages, FAQs, and more
                  </p>
                </div>
              </div>
            </div>
            
            <Link href="/pricing" className="block mt-6">
              <Button className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]">
                View Plans
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  )
}
