"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Check, Sparkles, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature?: "scan" | "generate" | "checklist" | "history"
  title?: string
  description?: string
}

export function UpgradeModal({ 
  isOpen, 
  onClose, 
  feature = "scan",
  title,
  description 
}: UpgradeModalProps) {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly")
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  if (!isOpen) return null

  const featureTitles: Record<string, string> = {
    scan: "Unlock More Scans",
    generate: "Unlock Content Generation",
    checklist: "Unlock AI Visibility Checklist",
    history: "Unlock Scan History",
  }

  const featureDescriptions: Record<string, string> = {
    scan: "You've used your free scan. Upgrade to run more scans and track your AI visibility over time.",
    generate: "Generate AI-optimized content drafts to improve your visibility on ChatGPT, Claude, and other AI tools.",
    checklist: "Access the complete AI Visibility Checklist to systematically improve your discoverability.",
    history: "View your full scan history and track how your AI visibility improves over time.",
  }

  const handleSelectPlan = async (plan: "starter" | "pro_monthly" | "pro_annual") => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="size-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="size-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="size-6 text-[#2563EB]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E293B] mb-2">
              {title || featureTitles[feature]}
            </h2>
            <p className="text-[#64748B] text-sm sm:text-base">
              {description || featureDescriptions[feature]}
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2 mb-6 bg-gray-100 rounded-lg p-1 max-w-xs mx-auto">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                billingPeriod === "monthly"
                  ? "bg-white text-[#1E293B] shadow-sm"
                  : "text-[#64748B]"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("annual")}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1",
                billingPeriod === "annual"
                  ? "bg-white text-[#1E293B] shadow-sm"
                  : "text-[#64748B]"
              )}
            >
              Annual
              <span className="text-[10px] bg-[#10B981] text-white px-1.5 py-0.5 rounded">
                -33%
              </span>
            </button>
          </div>

          {/* Plan options */}
          <div className="space-y-4">
            {/* Starter */}
            <div className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[#1E293B]">Starter</h3>
                  <p className="text-sm text-[#64748B]">10 scans/month</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#1E293B]">$19</span>
                  <span className="text-[#64748B] text-sm">/mo</span>
                </div>
              </div>
              <ul className="space-y-1.5 mb-4">
                <li className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#10B981]" />
                  10 AI visibility scans/month
                </li>
                <li className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#10B981]" />
                  AI Visibility Checklist
                </li>
                <li className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#10B981]" />
                  Generate content drafts
                </li>
              </ul>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleSelectPlan("starter")}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === "starter" && <Loader2 className="size-4 animate-spin mr-2" />}
                Get Starter
              </Button>
            </div>

            {/* Pro */}
            <div className="border-2 border-[#2563EB] rounded-xl p-4 relative">
              <div className="absolute -top-2.5 left-4">
                <span className="bg-[#2563EB] text-white text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1">
                  <Sparkles className="size-3" />
                  Best Value
                </span>
              </div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <div>
                  <h3 className="font-semibold text-[#1E293B]">Pro</h3>
                  <p className="text-sm text-[#64748B]">Unlimited scans</p>
                </div>
                <div className="text-right">
                  {billingPeriod === "annual" ? (
                    <>
                      <span className="text-2xl font-bold text-[#1E293B]">$299</span>
                      <span className="text-[#64748B] text-sm">/yr</span>
                      <div className="text-xs text-[#10B981]">$25/mo</div>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-[#1E293B]">$37</span>
                      <span className="text-[#64748B] text-sm">/mo</span>
                    </>
                  )}
                </div>
              </div>
              <ul className="space-y-1.5 mb-4">
                <li className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#2563EB]" />
                  <strong className="text-[#1E293B]">Unlimited</strong> AI visibility scans
                </li>
                <li className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#2563EB]" />
                  AI Visibility Checklist
                </li>
                <li className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#2563EB]" />
                  Generate content drafts
                </li>
                <li className="flex items-center gap-2 text-sm text-[#64748B]">
                  <Check className="size-4 text-[#2563EB]" />
                  Priority support
                </li>
              </ul>
              <Button
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
                onClick={() => handleSelectPlan(billingPeriod === "annual" ? "pro_annual" : "pro_monthly")}
                disabled={loadingPlan !== null}
              >
                {(loadingPlan === "pro_monthly" || loadingPlan === "pro_annual") && (
                  <Loader2 className="size-4 animate-spin mr-2" />
                )}
                Go Pro
              </Button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-[#9CA3AF] mt-6">
            Cancel anytime. No questions asked.
          </p>
        </div>
      </div>
    </div>
  )
}

// Scan limit modal for Starter users
interface ScanLimitModalProps {
  isOpen: boolean
  onClose: () => void
  scansUsed: number
  scansLimit: number
  resetDate: string | null
}

export function ScanLimitModal({ 
  isOpen, 
  onClose, 
  scansUsed, 
  scansLimit,
  resetDate 
}: ScanLimitModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly")

  if (!isOpen) return null

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "your next billing date"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })
  }

  const handleUpgrade = async () => {
    setLoadingPlan(billingPeriod === "annual" ? "pro_annual" : "pro_monthly")

    try {
      const plan = billingPeriod === "annual" ? "pro_annual" : "pro_monthly"
      const priceId = billingPeriod === "annual"
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
      }
    } catch (error) {
      console.error("Checkout error:", error)
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="size-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="size-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚡</span>
            </div>
            <h2 className="text-xl font-bold text-[#1E293B] mb-2">
              Monthly Scan Limit Reached
            </h2>
            <p className="text-[#64748B]">
              You've used {scansUsed} of {scansLimit} scans this month.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-4">
            {/* Wait option */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="font-medium text-[#1E293B] mb-1">Wait for reset</h3>
              <p className="text-sm text-[#64748B]">
                Your scans will reset on {formatDate(resetDate)}.
              </p>
            </div>

            {/* Upgrade option */}
            <div className="border-2 border-[#2563EB] rounded-xl p-4 bg-blue-50/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-[#1E293B]">Upgrade to Pro</h3>
                  <p className="text-sm text-[#64748B]">Get unlimited scans</p>
                </div>
                <span className="text-xs bg-[#10B981] text-white px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              
              {/* Billing toggle */}
              <div className="flex items-center gap-2 mb-3 bg-white rounded-lg p-1">
                <button
                  onClick={() => setBillingPeriod("monthly")}
                  className={cn(
                    "flex-1 px-2 py-1 rounded text-xs font-medium transition-all",
                    billingPeriod === "monthly"
                      ? "bg-gray-100 text-[#1E293B]"
                      : "text-[#64748B]"
                  )}
                >
                  $37/mo
                </button>
                <button
                  onClick={() => setBillingPeriod("annual")}
                  className={cn(
                    "flex-1 px-2 py-1 rounded text-xs font-medium transition-all",
                    billingPeriod === "annual"
                      ? "bg-gray-100 text-[#1E293B]"
                      : "text-[#64748B]"
                  )}
                >
                  $299/yr (save 33%)
                </button>
              </div>

              <p className="text-xs text-[#64748B] mb-3">
                Just ${billingPeriod === "annual" ? "25" : "37"}/month more for unlimited scans
              </p>

              <Button
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
                onClick={handleUpgrade}
                disabled={loadingPlan !== null}
              >
                {loadingPlan && <Loader2 className="size-4 animate-spin mr-2" />}
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
