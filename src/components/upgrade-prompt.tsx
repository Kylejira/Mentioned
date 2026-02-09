"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, Lock, Zap, ArrowRight, X, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface UpgradePromptProps {
  feature: "scan" | "generate" | "checklist" | "history"
  onClose?: () => void
  inline?: boolean
  className?: string
}

const featureMessages = {
  scan: {
    title: "Unlock More Scans",
    description: "You've used your free scan. Upgrade to run more scans and track your AI visibility over time.",
    icon: Zap,
  },
  generate: {
    title: "Unlock AI Content Generation",
    description: "Generate comparison pages, FAQ content, and homepage copy with AI — all tailored to your product.",
    icon: Sparkles,
  },
  checklist: {
    title: "Unlock AI Visibility Checklist",
    description: "Access the complete checklist to systematically improve your discoverability by AI tools.",
    icon: Lock,
  },
  history: {
    title: "Unlock Scan History",
    description: "View your full scan history and track how your AI visibility improves over time.",
    icon: Lock,
  },
}

export function UpgradePrompt({ feature, onClose, inline = false, className }: UpgradePromptProps) {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly")
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  
  const message = featureMessages[feature]
  const Icon = message.icon

  const handleSelectPlan = async (plan: "starter" | "pro_monthly" | "pro_annual") => {
    setLoadingPlan(plan)

    try {
      // Send just the plan - server will look up the price ID
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
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

  if (inline) {
    // Inline version for embedding in page
    return (
      <div className={cn("bg-muted/50 border border-border rounded-xl p-6", className)}>
        <div className="flex items-start gap-4">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{message.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message.description}</p>
            <Button onClick={() => router.push("/pricing")} className="mt-4" size="sm">
              <Sparkles className="size-4 mr-2" />
              View Plans
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Modal/overlay version with pricing options
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="size-5" />
          </button>
        )}

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="size-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon className="size-6 text-[#2563EB]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E293B] mb-2">
              {message.title}
            </h2>
            <p className="text-[#64748B] text-sm sm:text-base">
              {message.description}
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

/**
 * Button wrapper that shows upgrade prompt if feature is locked
 */
interface GatedButtonProps {
  feature: "scan" | "generate"
  canAccess: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
  variant?: "default" | "secondary" | "ghost" | "outline"
  size?: "default" | "sm" | "lg" | "icon"
  disabled?: boolean
}

export function GatedButton({
  feature,
  canAccess,
  onClick,
  children,
  className,
  variant = "default",
  size = "default",
  disabled = false,
}: GatedButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (canAccess) {
      onClick()
    } else {
      router.push("/pricing")
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled}
      className={cn(className, !canAccess && "opacity-90")}
    >
      {!canAccess && <Lock className="size-3.5 mr-1.5" />}
      {children}
    </Button>
  )
}
