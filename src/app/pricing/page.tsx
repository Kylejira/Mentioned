"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PLANS, useSubscription } from "@/lib/subscription"
import { useAuth } from "@/lib/auth"
import { Check, X, Sparkles, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export default function PricingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { status, isLoading } = useSubscription()

  const handleSelectPlan = (planKey: string) => {
    if (planKey === "free") {
      // Already on free, go to dashboard
      router.push("/dashboard")
      return
    }

    if (planKey === "enterprise") {
      // Contact sales - could open email or contact form
      window.location.href = "mailto:hello@mentioned.ai?subject=Enterprise%20Plan%20Inquiry"
      return
    }

    // For Pro plan - this will be replaced with Stripe checkout
    // For now, show a message
    alert("Payment integration coming soon! For now, enjoy the free tier.")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back link */}
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <Link
          href={user ? "/dashboard" : "/"}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          {user ? "Back to dashboard" : "Back to home"}
        </Link>
      </div>

      {/* Header */}
      <div className="mx-auto max-w-5xl px-6 py-12 text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Choose your plan
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Start free with one visibility scan. Upgrade to unlock unlimited scans and AI-powered content generation.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(PLANS).map(([key, plan]) => {
            const isCurrentPlan = status === key
            const isPro = key === "pro"

            return (
              <Card
                key={key}
                className={cn(
                  "relative overflow-hidden transition-shadow",
                  isPro && "border-primary shadow-lg",
                  isCurrentPlan && "ring-2 ring-primary"
                )}
              >
                {/* Popular badge */}
                {isPro && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-lg">
                    Most Popular
                  </div>
                )}

                <CardContent className="p-6">
                  {/* Plan name */}
                  <h3 className="text-lg font-semibold text-foreground">
                    {plan.name}
                  </h3>

                  {/* Price */}
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.priceLabel}
                    </span>
                    <span className="text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>

                  {/* CTA Button */}
                  <Button
                    className={cn(
                      "w-full mt-6",
                      isPro && "bg-primary hover:bg-primary/90"
                    )}
                    variant={isPro ? "default" : "secondary"}
                    onClick={() => handleSelectPlan(key)}
                    disabled={isCurrentPlan || isLoading}
                  >
                    {isCurrentPlan ? (
                      "Current Plan"
                    ) : isPro ? (
                      <>
                        <Sparkles className="size-4 mr-2" />
                        {plan.cta}
                      </>
                    ) : (
                      plan.cta
                    )}
                  </Button>

                  {/* Features */}
                  <div className="mt-8 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Check className="size-5 text-status-success shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}

                    {/* Limitations */}
                    {plan.limitations.map((limitation, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <X className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{limitation}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Questions? Email us at{" "}
            <a
              href="mailto:hello@mentioned.ai"
              className="text-foreground underline hover:no-underline"
            >
              hello@mentioned.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
