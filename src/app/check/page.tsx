"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { createClient, isSupabaseConfigured } from "@/lib/supabase"
import { useSubscription } from "@/lib/subscription"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ArrowRight, X, Check, Loader2, User, AlertCircle, Lock, Info, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface FormData {
  brandName: string
  websiteUrl: string
  coreProblem: string
  targetBuyer: string
  differentiators: string
  competitors: string[]
  buyerQuestions: string
}

type LoadingStep = {
  id: string
  label: string
  status: "pending" | "active" | "complete" | "error"
}

const FORM_STORAGE_KEY = "mentioned_check_form"

const SCAN_RESULT_KEY_BASE = "mentioned_scan_result"
function getScanResultKey(userId?: string | null): string {
  return userId ? `${SCAN_RESULT_KEY_BASE}_${userId}` : SCAN_RESULT_KEY_BASE
}

export default function CheckPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const subscription = useSubscription()
  
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const scanAbortRef = useRef<AbortController | null>(null)
  const scanSessionRef = useRef<string | null>(null)
  const formDataRef = useRef<FormData | null>(null)
  const [formData, setFormData] = useState<FormData>({
    brandName: "",
    websiteUrl: "",
    coreProblem: "",
    targetBuyer: "",
    differentiators: "",
    competitors: [],
    buyerQuestions: "",
  })
  const [competitorInput, setCompetitorInput] = useState("")
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    { id: "profile", label: "Scanning your website", status: "pending" },
    { id: "queries", label: "Generating AI search queries", status: "pending" },
    { id: "chatgpt", label: "Querying ChatGPT", status: "pending" },
    { id: "claude", label: "Querying Claude", status: "pending" },
    { id: "analysis", label: "Analyzing & scoring results", status: "pending" },
  ])
  const [loadingElapsed, setLoadingElapsed] = useState(0)

  // Load form data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(FORM_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setFormData(parsed)
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (formData.brandName || formData.websiteUrl || formData.coreProblem) {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData))
    }
  }, [formData])

  // URL validation
  const isValidUrl = (url: string) => {
    if (!url) return false
    const urlPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}|^https?:\/\/.+/
    return urlPattern.test(url)
  }

  const isFormValid =
    formData.brandName.trim() !== "" &&
    isValidUrl(formData.websiteUrl) &&
    formData.coreProblem.trim().length >= 15 &&
    formData.targetBuyer.trim().length >= 8

  // Handle competitor addition
  const addCompetitor = () => {
    const trimmed = competitorInput.trim()
    if (
      trimmed &&
      formData.competitors.length < 5 &&
      !formData.competitors.includes(trimmed)
    ) {
      setFormData((prev) => ({
        ...prev,
        competitors: [...prev.competitors, trimmed],
      }))
      setCompetitorInput("")
    }
  }

  const removeCompetitor = (competitor: string) => {
    setFormData((prev) => ({
      ...prev,
      competitors: prev.competitors.filter((c) => c !== competitor),
    }))
  }

  // Save brand data to database
  const saveBrandData = async () => {
    if (!user) return

    const supabase = createClient()
    if (!supabase) return

    setIsSaving(true)

    try {
      const { data: existingBrands } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)

      if (existingBrands && existingBrands.length > 0) {
        const brandId = existingBrands[0].id

        await supabase
          .from("brands")
          .update({
            name: formData.brandName,
            url: formData.websiteUrl,
            description: formData.coreProblem,
            category: "software",
          })
          .eq("id", brandId)

        await supabase.from("competitors").delete().eq("brand_id", brandId)

        if (formData.competitors.length > 0) {
          await supabase.from("competitors").insert(
            formData.competitors.map((name) => ({
              brand_id: brandId,
              name,
            }))
          )
        }
      } else {
        const { data: newBrand } = await supabase
          .from("brands")
          .insert({
            user_id: user.id,
            name: formData.brandName,
            url: formData.websiteUrl,
            description: formData.coreProblem,
            category: "software",
          })
          .select()
          .single()

        if (newBrand && formData.competitors.length > 0) {
          await supabase.from("competitors").insert(
            formData.competitors.map((name) => ({
              brand_id: newBrand.id,
              name,
            }))
          )
        }
      }

      localStorage.removeItem(FORM_STORAGE_KEY)
    } catch (error) {
      console.error("Error saving brand:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!isFormValid) return

    if (isSupabaseConfigured() && !user) {
      setShowAuthPrompt(true)
      return
    }

    if (user && !subscription.canScan) {
      setShowUpgradePrompt(true)
      return
    }

    if (user) {
      await saveBrandData()
    }
    setIsLoading(true)
  }

  // Handle auth prompt actions
  const handleAuthAction = (action: "login" | "signup") => {
    router.push(`/${action}?redirect=/check`)
  }

  // Continue after returning from auth
  useEffect(() => {
    if (user && !authLoading) {
      const saved = localStorage.getItem(FORM_STORAGE_KEY)
      if (saved && showAuthPrompt) {
        setShowAuthPrompt(false)
        handleSubmit()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  // Track loading elapsed time
  useEffect(() => {
    if (!isLoading) {
      setLoadingElapsed(0)
      return
    }

    const timer = setInterval(() => {
      setLoadingElapsed(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isLoading])

  // Run actual scan
  useEffect(() => {
    if (!isLoading) return
    
    const currentSessionId = `scan_${Date.now()}_${Math.random().toString(36).slice(2)}`
    
    if (scanSessionRef.current) {
      console.log("[Check] Scan session already active:", scanSessionRef.current, "- skipping duplicate")
      return
    }
    
    scanSessionRef.current = currentSessionId
    formDataRef.current = { ...formData }

    const runScan = async () => {
      const scanFormData = formDataRef.current!
      
      setScanError(null)
      
      const abortController = new AbortController()
      scanAbortRef.current = abortController

      // Get brand ID if user is authenticated
      let brandId: string | undefined
      if (user && isSupabaseConfigured()) {
        try {
          const supabase = createClient()
          if (supabase) {
            const { data } = await supabase
              .from("brands")
              .select("id")
              .eq("user_id", user.id)
              .limit(1)
            
            if (data && data.length > 0) {
              brandId = data[0].id
            }
          }
        } catch (e) {
          console.error("Failed to get brand ID:", e)
        }
      }

      // Save a "scanning" marker so the dashboard knows a scan is in progress
      // (prevents showing stale data from a different brand)
      try {
        const pendingData = JSON.stringify({
          brandName: scanFormData.brandName,
          brandUrl: scanFormData.websiteUrl,
          status: "scanning",
          timestamp: new Date().toISOString(),
        })
        localStorage.setItem(getScanResultKey(user?.id), pendingData)
        localStorage.removeItem(SCAN_RESULT_KEY_BASE)
        localStorage.removeItem("mentioned_last_scan")
        localStorage.removeItem(FORM_STORAGE_KEY)
      } catch (e) {
        console.error("[Check] Failed to set scan marker:", e)
      }

      // Parse buyer questions from textarea (one per line)
      const buyerQuestions = scanFormData.buyerQuestions
        .split("\n")
        .map(q => q.trim())
        .filter(q => q.length >= 10)
        .slice(0, 10)

      console.log("[Check] =============================================")
      console.log("[Check] STARTING SCAN WITH DATA:")
      console.log("[Check] Brand Name:", scanFormData.brandName)
      console.log("[Check] URL:", scanFormData.websiteUrl)
      console.log("[Check] Core Problem:", scanFormData.coreProblem.slice(0, 80))
      console.log("[Check] Target Buyer:", scanFormData.targetBuyer)
      console.log("[Check] Buyer Questions:", buyerQuestions.length)
      console.log("[Check] =============================================")

      // Start progress animation
      const stepIds = ["profile", "queries", "chatgpt", "claude", "analysis"]
      let currentStepIndex = 0

      const progressInterval = setInterval(() => {
        if (currentStepIndex < stepIds.length - 1) {
          setLoadingSteps((prev) =>
            prev.map((step, i) => {
              if (i === currentStepIndex) return { ...step, status: "complete" }
              if (i === currentStepIndex + 1) return { ...step, status: "active" }
              return step
            })
          )
          currentStepIndex++
        }
      }, 3000)

      setLoadingSteps((prev) =>
        prev.map((step, i) =>
          i === 0 ? { ...step, status: "active" } : step
        )
      )

      try {
        const isPaidPlan = subscription.plan === "pro" || subscription.plan === "starter"
        
        const SCAN_TIMEOUT = 240000
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            abortController.abort()
            reject(new Error("SCAN_TIMEOUT"))
          }, SCAN_TIMEOUT)
        })

        // Ensure URL has protocol
        let normalizedUrl = scanFormData.websiteUrl
        if (!normalizedUrl.startsWith("http")) {
          normalizedUrl = "https://" + normalizedUrl
        }
        
        const response = await Promise.race([
          fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brandId,
              brandName: scanFormData.brandName,
              brandUrl: normalizedUrl,
              // New v3 fields
              coreProblem: scanFormData.coreProblem,
              targetBuyer: scanFormData.targetBuyer,
              differentiators: scanFormData.differentiators || undefined,
              competitors: scanFormData.competitors,
              buyerQuestions: buyerQuestions.length > 0 ? buyerQuestions : undefined,
              isPaidPlan,
            }),
            signal: abortController.signal,
          }),
          timeoutPromise
        ])

        clearInterval(progressInterval)

        if (!response.ok) {
          let errorMessage = "Scan failed"
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            try {
              const text = await response.text()
              if (text) errorMessage = text.slice(0, 100)
            } catch {
              // Ignore
            }
          }
          throw new Error(errorMessage)
        }

        let result
        try {
          result = await response.json()
        } catch {
          throw new Error("Invalid response from server. Please try again.")
        }

        const finalCategory = result.category || "Software"
        
        const scanDataToSave = {
          ...result,
          brandName: scanFormData.brandName,
          brandUrl: normalizedUrl,
          category: finalCategory,
          timestamp: new Date().toISOString(),
        }
        
        localStorage.setItem(getScanResultKey(user?.id), JSON.stringify(scanDataToSave))

        localStorage.removeItem(FORM_STORAGE_KEY)

        if (subscription.plan === "free") {
          await subscription.markFreeScanUsed()
        }
        if (subscription.plan === "starter") {
          await subscription.incrementScanCount()
        }

        setLoadingSteps((prev) =>
          prev.map((step) => ({ ...step, status: "complete" }))
        )

        scanSessionRef.current = null
        
        setTimeout(() => {
          router.push("/dashboard")
        }, 500)
      } catch (error) {
        clearInterval(progressInterval)
        
        scanSessionRef.current = null
        
        if (error instanceof Error && error.name === "AbortError") return

        console.error("[Check] Scan error:", error)
        
        try {
          const failedData = JSON.stringify({
            brandName: formDataRef.current?.brandName || "",
            status: "failed",
            timestamp: new Date().toISOString(),
          })
          localStorage.setItem(getScanResultKey(user?.id), failedData)
          localStorage.removeItem(SCAN_RESULT_KEY_BASE)
          localStorage.removeItem("mentioned_last_scan")
        } catch (e) {
          console.error("[Check] Failed to update scan marker:", e)
        }
        
        setLoadingSteps((prev) =>
          prev.map((step) => 
            step.status === "active" ? { ...step, status: "error" } : step
          )
        )
        
        let errorMessage = "Something went wrong. Please try again."
        if (error instanceof Error) {
          if (error.message === "SCAN_TIMEOUT") {
            errorMessage = "Scan timed out after 4 minutes. AI services may be experiencing high demand. Please try again."
          } else if (error.message.includes("BOTH_PROVIDERS_FAILED") || error.message.includes("NO_RESULTS")) {
            errorMessage = "We couldn't get responses from AI services right now. Please try again in a few moments."
          } else if (error.message.includes("fetch") || error.message.includes("network")) {
            errorMessage = "Network error. Please check your connection and try again."
          } else {
            errorMessage = error.message
          }
        }
        
        setScanError(errorMessage)
      }
    }

    runScan()

    return () => {
      if (scanAbortRef.current) {
        scanAbortRef.current.abort()
      }
    }
  }, [isLoading, router])

  // Auth prompt overlay
  if (showAuthPrompt) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-20">
          <Card className="w-full max-w-md animate-scale-in">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <User className="size-6 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Create an account to save your results
              </h2>
              <p className="text-muted-foreground mb-6">
                Your scan results will be saved so you can track your AI visibility over time.
              </p>

              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => handleAuthAction("signup")}
                >
                  Create account
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleAuthAction("login")}
                >
                  Log in
                </Button>
              </div>

              <button
                onClick={() => setShowAuthPrompt(false)}
                className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Go back
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const handleRetry = () => {
    scanSessionRef.current = null
    setScanError(null)
    setIsLoading(false)
    setIsSaving(false)
    setLoadingElapsed(0)
    setLoadingSteps((prev) =>
      prev.map((step) => ({ ...step, status: "pending" }))
    )
    try {
      localStorage.removeItem(getScanResultKey(user?.id))
      localStorage.removeItem(SCAN_RESULT_KEY_BASE)
      localStorage.removeItem("mentioned_last_scan")
    } catch (e) {
      console.error("[Check] Failed to clear localStorage:", e)
    }
  }

  const handleCancel = () => {
    scanSessionRef.current = null
    if (scanAbortRef.current) {
      scanAbortRef.current.abort()
    }
    setIsLoading(false)
    setScanError(null)
    setLoadingSteps((prev) =>
      prev.map((step) => ({ ...step, status: "pending" }))
    )
  }

  // Loading state
  if (isLoading || isSaving) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-20">
          <div className="text-center max-w-md animate-fade-in">
            <div className="mb-8">
              <Image
                src="/logo.png"
                alt="Mentioned"
                width={40}
                height={40}
                className="rounded-xl mx-auto"
              />
            </div>

            {scanError ? (
              <>
                <div className="size-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="size-6 text-red-500" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Something went wrong
                </h1>
                <p className="text-muted-foreground mb-2">
                  {scanError}
                </p>
                <p className="text-sm text-muted-foreground/80 mb-6">
                  Don&apos;t worry — your form data is saved. Click below to try again.
                </p>
                <div className="flex flex-col gap-3 items-center">
                  <Button onClick={handleRetry} className="w-full max-w-[200px]">
                    Try Again
                  </Button>
                  <button
                    onClick={handleCancel}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Go back to form
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  {isSaving ? "Saving your product..." : "Checking how AI tools see your product..."}
                </h1>
                <p className="text-muted-foreground mb-6">
                  {isSaving 
                    ? "Just a moment" 
                    : loadingElapsed >= 180
                      ? "Almost there — finalizing your results..."
                      : loadingElapsed >= 120
                        ? "Taking a bit longer than usual — hang tight..."
                        : "This usually takes 2–3 minutes"
                  }
                </p>

                {!isSaving && (
                  <>
                    <div className="w-full max-w-xs mx-auto mb-8">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          {Math.floor(loadingElapsed / 60)}:{String(loadingElapsed % 60).padStart(2, '0')} elapsed
                        </span>
                        <span className="text-muted-foreground">
                          {loadingElapsed < 180 
                            ? `~${Math.max(240 - loadingElapsed, 60)}s remaining`
                            : loadingElapsed < 220
                              ? "Almost done..."
                              : "Finishing up..."
                          }
                        </span>
                      </div>
                      
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000 ease-out"
                          style={{ 
                            width: `${Math.min(
                              loadingElapsed < 40 ? loadingElapsed * 1 :
                              loadingElapsed < 120 ? 40 + (loadingElapsed - 40) * 0.44 :
                              loadingElapsed < 180 ? 75 + (loadingElapsed - 120) * 0.25 :
                              90 + Math.min((loadingElapsed - 180) * 0.12, 7),
                              97
                            )}%` 
                          }}
                        />
                      </div>
                      
                      <div className="text-center mt-2">
                        <span className="text-lg font-semibold text-foreground">
                          {Math.min(
                            loadingElapsed < 40 ? loadingElapsed * 1 :
                            loadingElapsed < 120 ? 40 + Math.floor((loadingElapsed - 40) * 0.44) :
                            loadingElapsed < 180 ? 75 + Math.floor((loadingElapsed - 120) * 0.25) :
                            90 + Math.min(Math.floor((loadingElapsed - 180) * 0.12), 7),
                            97
                          )}%
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center mb-6">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="size-2 rounded-full bg-primary animate-pulse-subtle"
                            style={{ animationDelay: `${i * 0.2}s` }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 text-left mb-8">
                      {loadingSteps.map((step) => (
                        <div
                          key={step.id}
                          className={cn(
                            "flex items-center gap-3 transition-opacity duration-300",
                            step.status === "pending" && "opacity-40"
                          )}
                        >
                          <div className="size-5 flex items-center justify-center">
                            {step.status === "complete" ? (
                              <Check className="size-4 text-status-success" />
                            ) : step.status === "active" ? (
                              <Loader2 className="size-4 text-foreground animate-spin" />
                            ) : step.status === "error" ? (
                              <AlertCircle className="size-4 text-status-error" />
                            ) : (
                              <div className="size-2 rounded-full bg-muted-foreground/30" />
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-sm",
                              step.status === "complete"
                                ? "text-muted-foreground"
                                : step.status === "active"
                                ? "text-foreground font-medium"
                                : step.status === "error"
                                ? "text-status-error"
                                : "text-muted-foreground"
                            )}
                          >
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleCancel}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
                
                {isSaving && (
                  <div className="flex justify-center">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="size-2 rounded-full bg-primary animate-pulse-subtle"
                          style={{ animationDelay: `${i * 0.2}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Main Form ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-6">
          <div className="flex h-14 items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Mentioned"
                width={24}
                height={24}
                className="rounded-md"
              />
              <span className="font-semibold text-foreground text-sm">Mentioned</span>
            </Link>
            <div className="w-14" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-2xl px-6 py-12">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Check your AI visibility
          </h1>
          <p className="text-muted-foreground mt-2">
            Tell us about your product and we&apos;ll see how AI tools recommend it.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-10">

          {/* ── STEP 1: Your Product ── */}
          <section className="space-y-6">
            <StepIndicator number={1} title="Your product" />

            <div className="space-y-2">
              <FormInput
                label="Brand name"
                placeholder="e.g., Notion, Linear, Cal.com"
                value={formData.brandName}
                maxLength={80}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, brandName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <FormInput
                label="Website URL"
                placeholder="https://yourproduct.com"
                value={formData.websiteUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, websiteUrl: e.target.value }))
                }
                error={
                  formData.websiteUrl && !isValidUrl(formData.websiteUrl)
                    ? "Please enter a valid URL"
                    : undefined
                }
              />
              <p className="text-xs text-muted-foreground">
                We&apos;ll scan your site to build your AI visibility profile.
              </p>
            </div>
          </section>

          {/* ── STEP 2: Your Market ── */}
          <section className="space-y-6">
            <StepIndicator number={2} title="Your market" />

            {/* Core Problem */}
            <div className="space-y-2">
              <Label htmlFor="coreProblem" className="text-sm font-medium text-foreground">
                What problem does your product solve? *
              </Label>
              <textarea
                id="coreProblem"
                placeholder="e.g., Teams waste hours coordinating schedules across time zones. We eliminate back-and-forth booking."
                value={formData.coreProblem}
                maxLength={300}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, coreProblem: e.target.value }))
                }
                rows={2}
                className={cn(
                  "flex w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground transition-all duration-200",
                  "placeholder:text-muted-foreground/60",
                  "hover:border-border/80",
                  "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10",
                  "resize-none"
                )}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Describe the #1 pain point your customers had before finding you. This directly shapes the AI queries we test.
                </p>
                <CharCount current={formData.coreProblem.length} min={15} max={300} />
              </div>
            </div>

            {/* Target Buyer */}
            <div className="space-y-2">
              <Label htmlFor="targetBuyer" className="text-sm font-medium text-foreground">
                Who is your ideal customer? *
              </Label>
              <input
                id="targetBuyer"
                type="text"
                placeholder="e.g., Remote-first startup founders with 10-50 employees"
                value={formData.targetBuyer}
                maxLength={150}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetBuyer: e.target.value }))
                }
                className={cn(
                  "flex h-11 w-full rounded-xl border border-border bg-background px-4 py-2 text-base text-foreground transition-all duration-200",
                  "placeholder:text-muted-foreground/60",
                  "hover:border-border/80",
                  "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Who searches for tools like yours? Be specific about role, company size, or industry.
              </p>
            </div>

            {/* Differentiators */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="differentiators" className="text-sm font-medium text-foreground">
                  What makes you different?
                </Label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-medium">
                  <Sparkles className="size-3" />
                  Recommended
                </span>
              </div>
              <textarea
                id="differentiators"
                placeholder="e.g., Only scheduling tool with native async video messages. 10x faster than Calendly for team-wide availability. No login required for invitees."
                value={formData.differentiators}
                maxLength={300}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, differentiators: e.target.value }))
                }
                rows={2}
                className={cn(
                  "flex w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground transition-all duration-200",
                  "placeholder:text-muted-foreground/60",
                  "hover:border-border/80",
                  "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10",
                  "resize-none"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Your unique advantages over competitors. These shape the feature-specific queries we test.
              </p>
            </div>
          </section>

          {/* ── STEP 3: Competitive Context ── */}
          <section className="space-y-6">
            <StepIndicator number={3} title="Competitive context" optional />

            {/* Competitors */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Top competitors
              </Label>
              
              {formData.competitors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.competitors.map((competitor) => (
                    <span
                      key={competitor}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground"
                    >
                      {competitor}
                      <button
                        type="button"
                        onClick={() => removeCompetitor(competitor)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {formData.competitors.length < 5 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Calendly, SavvyCal, Doodle"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addCompetitor()
                      }
                    }}
                    className={cn(
                      "flex h-11 flex-1 rounded-xl border border-border bg-background px-4 py-2 text-base text-foreground transition-all duration-200",
                      "placeholder:text-muted-foreground/60",
                      "hover:border-border/80",
                      "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10"
                    )}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addCompetitor}
                    disabled={!competitorInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                We&apos;ll auto-detect competitors too, but naming yours improves accuracy.
                {formData.competitors.length > 0 && ` (${formData.competitors.length}/5)`}
              </p>
            </div>

            {/* Real Buyer Questions */}
            <div className="space-y-2">
              <Label htmlFor="buyerQuestions" className="text-sm font-medium text-foreground">
                Real buyer questions
              </Label>
              <textarea
                id="buyerQuestions"
                placeholder={`Paste real questions from:\n• Support tickets or sales calls\n• Reddit/forum threads about your category\n• Questions prospects actually asked you\n\nExample:\nIs there a scheduling tool that works with Google and Outlook without requiring the other person to sign up?`}
                value={formData.buyerQuestions}
                maxLength={500}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, buyerQuestions: e.target.value }))
                }
                rows={4}
                className={cn(
                  "flex w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground transition-all duration-200",
                  "placeholder:text-muted-foreground/60",
                  "hover:border-border/80",
                  "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10",
                  "resize-none"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Got real questions from prospects or forums? One question per line. Max 10.
              </p>
            </div>
          </section>

          {/* Helper hint */}
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-[#6B7280]">
            <Info className="size-4 flex-shrink-0" />
            <span>Mentioned works best for software products and SaaS tools.</span>
          </div>

          {/* Submit button */}
          <div className="pt-4">
            <Button
              size="xl"
              className="w-full"
              disabled={!isFormValid}
              onClick={handleSubmit}
            >
              Run AI Visibility Scan
              <ArrowRight className="ml-1" />
            </Button>
            {!isFormValid && (
              <p className="text-sm text-muted-foreground text-center mt-3">
                {!formData.brandName.trim()
                  ? "Enter your brand name to continue"
                  : !isValidUrl(formData.websiteUrl)
                  ? "Enter a valid website URL"
                  : formData.coreProblem.trim().length < 15
                  ? "Describe the problem your product solves (at least 15 characters)"
                  : formData.targetBuyer.trim().length < 8
                  ? "Describe your target customer (at least 8 characters)"
                  : "Fill in all required fields to continue"
                }
              </p>
            )}
            {user && subscription.freeScanUsed && !subscription.canScan && (
              <div className="mt-4 p-4 bg-muted/50 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <Lock className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Free scan used</p>
                    <p className="text-sm text-muted-foreground">
                      Upgrade to Pro for unlimited scans.{" "}
                      <Link href="/pricing" className="text-primary underline hover:no-underline">
                        View plans
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && (
        <UpgradePrompt
          feature="scan"
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}
    </div>
  )
}

function StepIndicator({
  number,
  title,
  optional = false,
}: {
  number: number
  title: string
  optional?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
        {number}
      </span>
      <span className="text-sm font-medium text-foreground">{title}</span>
      {optional && (
        <span className="text-xs text-muted-foreground">(optional)</span>
      )}
    </div>
  )
}

function CharCount({ current, min, max }: { current: number; min: number; max: number }) {
  if (current === 0) return null
  
  if (current < min) {
    return (
      <span className="text-xs text-status-error whitespace-nowrap">
        {min - current} more needed
      </span>
    )
  }
  
  if (current > max * 0.9) {
    return (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {current}/{max}
      </span>
    )
  }
  
  return (
    <span className="text-xs text-status-success whitespace-nowrap">
      Good
    </span>
  )
}
