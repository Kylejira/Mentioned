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
import { ArrowLeft, ArrowRight, X, Check, Loader2, User, AlertCircle, Lock, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface FormData {
  brandName: string
  websiteUrl: string
  productDescription: string
  categories: string[]
  competitors: string[]
  customQueries: string[]
}

type LoadingStep = {
  id: string
  label: string
  status: "pending" | "active" | "complete" | "error"
}

const FORM_STORAGE_KEY = "mentioned_check_form"

const SCAN_RESULT_KEY = "mentioned_scan_result"

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
  const [formData, setFormData] = useState<FormData>({
    brandName: "",
    websiteUrl: "",
    productDescription: "",
    categories: [],
    competitors: [],
    customQueries: [],
  })
  const [categoryInput, setCategoryInput] = useState("")
  const [competitorInput, setCompetitorInput] = useState("")
  const [customQueryInput, setCustomQueryInput] = useState("")
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    { id: "queries", label: "Generating test queries", status: "pending" },
    { id: "chatgpt", label: "Querying ChatGPT", status: "pending" },
    { id: "claude", label: "Querying Claude", status: "pending" },
    { id: "analysis", label: "Analyzing results", status: "pending" },
    { id: "recommendations", label: "Generating recommendations", status: "pending" },
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
    if (formData.brandName || formData.websiteUrl || formData.productDescription) {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData))
    }
  }, [formData])

  // Form validation
  const isValidUrl = (url: string) => {
    if (!url) return false
    const urlPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}|^https?:\/\/.+/
    return urlPattern.test(url)
  }

  const isFormValid =
    formData.brandName.trim() !== "" &&
    isValidUrl(formData.websiteUrl) &&
    formData.productDescription.trim() !== ""

  // Generate category queries based on input
  const generateQueries = useCallback(() => {
    if (!formData.productDescription || !formData.brandName) return []

    const desc = formData.productDescription.toLowerCase()
    
    let category = "software"
    let useCase = ""

    if (desc.includes("project management")) category = "project management"
    else if (desc.includes("crm") || desc.includes("customer relationship")) category = "CRM"
    else if (desc.includes("email") && desc.includes("marketing")) category = "email marketing"
    else if (desc.includes("analytics")) category = "analytics"
    else if (desc.includes("design")) category = "design"
    else if (desc.includes("sales")) category = "sales"
    else if (desc.includes("hr") || desc.includes("human resources")) category = "HR"
    else if (desc.includes("accounting") || desc.includes("finance")) category = "accounting"
    else if (desc.includes("marketing")) category = "marketing"
    else if (desc.includes("collaboration")) category = "collaboration"
    else if (desc.includes("communication")) category = "communication"
    else {
      const words = formData.productDescription.split(" ").slice(0, 3).join(" ")
      category = words
    }

    if (desc.includes("for ")) {
      const forIndex = desc.indexOf("for ")
      useCase = formData.productDescription.slice(forIndex + 4).split(/[.,]/)[0].trim()
    } else if (desc.includes("teams")) {
      useCase = "teams"
    } else if (desc.includes("startups")) {
      useCase = "startups"
    } else if (desc.includes("enterprise")) {
      useCase = "enterprise"
    }

    const queries = [`Best ${category} tools`]
    if (useCase) {
      queries.push(`${category.charAt(0).toUpperCase() + category.slice(1)} for ${useCase}`)
    }
    queries.push(`${formData.brandName} alternatives`)

    return queries
  }, [formData.productDescription, formData.brandName])

  const queries = generateQueries()

  // Handle category addition
  const addCategory = () => {
    const trimmed = categoryInput.trim().toLowerCase()
    if (
      trimmed &&
      formData.categories.length < 3 &&
      !formData.categories.map(c => c.toLowerCase()).includes(trimmed)
    ) {
      setFormData((prev) => ({
        ...prev,
        categories: [...prev.categories, categoryInput.trim()],
      }))
      setCategoryInput("")
    }
  }

  const removeCategory = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== category),
    }))
  }

  // Handle competitor addition
  const addCompetitor = () => {
    const trimmed = competitorInput.trim()
    if (
      trimmed &&
      formData.competitors.length < 3 &&
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

  // Handle custom query addition
  const addCustomQuery = () => {
    const trimmed = customQueryInput.trim()
    if (
      trimmed &&
      formData.customQueries.length < 2 &&
      !formData.customQueries.includes(trimmed)
    ) {
      setFormData((prev) => ({
        ...prev,
        customQueries: [...prev.customQueries, trimmed],
      }))
      setCustomQueryInput("")
    }
  }

  const removeCustomQuery = (query: string) => {
    setFormData((prev) => ({
      ...prev,
      customQueries: prev.customQueries.filter((q) => q !== query),
    }))
  }

  // Extract category from description
  const extractCategory = (description: string): string => {
    const desc = description.toLowerCase()
    if (desc.includes("project management")) return "project management"
    if (desc.includes("crm")) return "CRM"
    if (desc.includes("email marketing")) return "email marketing"
    if (desc.includes("analytics")) return "analytics"
    if (desc.includes("design")) return "design"
    if (desc.includes("sales")) return "sales"
    if (desc.includes("hr")) return "HR"
    if (desc.includes("accounting")) return "accounting"
    if (desc.includes("marketing")) return "marketing"
    return "software"
  }

  // Save brand data to database
  const saveBrandData = async () => {
    if (!user) return

    const supabase = createClient()
    if (!supabase) return // Skip if Supabase not configured

    setIsSaving(true)

    try {
      // Check if user already has a brand
      const { data: existingBrands } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)

      const category = extractCategory(formData.productDescription)

      if (existingBrands && existingBrands.length > 0) {
        // Update existing brand
        const brandId = existingBrands[0].id

        await supabase
          .from("brands")
          .update({
            name: formData.brandName,
            url: formData.websiteUrl,
            description: formData.productDescription,
            category,
          })
          .eq("id", brandId)

        // Delete existing competitors and add new ones
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
        // Create new brand
        const { data: newBrand } = await supabase
          .from("brands")
          .insert({
            user_id: user.id,
            name: formData.brandName,
            url: formData.websiteUrl,
            description: formData.productDescription,
            category,
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

      // Clear saved form data
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

    // If Supabase is configured and user is not authenticated, show auth prompt
    if (isSupabaseConfigured() && !user) {
      setShowAuthPrompt(true)
      return
    }

    // Check if user can run a scan (subscription check)
    if (user && !subscription.canScan) {
      setShowUpgradePrompt(true)
      return
    }

    // Save data and start loading
    if (user) {
      await saveBrandData()
    }
    setIsLoading(true)
  }

  // Handle auth prompt actions
  const handleAuthAction = (action: "login" | "signup") => {
    // Form data is already saved to localStorage
    router.push(`/${action}?redirect=/check`)
  }

  // Continue after returning from auth
  useEffect(() => {
    // If user just authenticated and we have saved form data, continue
    if (user && !authLoading) {
      const saved = localStorage.getItem(FORM_STORAGE_KEY)
      if (saved && showAuthPrompt) {
        setShowAuthPrompt(false)
        // Auto-submit after auth
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

    const runScan = async () => {
      // Reset error state
      setScanError(null)
      
      // Create abort controller for cancellation
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

      // ONLY use category if user MANUALLY selected one
      // If no manual selection, pass null to let AI extract the best category from website
      const category = formData.categories.length > 0 
        ? formData.categories[0] 
        : null // Don't auto-extract - let AI determine from website content
      
      // CRITICAL: Clear ALL stale data before starting new scan
      try {
        localStorage.removeItem(SCAN_RESULT_KEY)
        localStorage.removeItem("mentioned_last_scan")
        localStorage.removeItem(FORM_STORAGE_KEY) // Also clear old form data
        console.log("[Check] Cleared ALL stale data from localStorage")
      } catch (e) {
        console.error("[Check] Failed to clear localStorage:", e)
      }
      
      // Log the EXACT data we're about to scan - this is critical for debugging
      const scanInput = {
        brandName: formData.brandName,
        url: formData.websiteUrl,
        category,
        categories: formData.categories,
        competitors: formData.competitors,
        timestamp: new Date().toISOString()
      }
      console.log("[Check] =============================================")
      console.log("[Check] STARTING SCAN WITH THIS DATA:")
      console.log("[Check] Brand Name:", scanInput.brandName)
      console.log("[Check] URL:", scanInput.url)
      console.log("[Check] Category:", category || "(AI will detect from website)")
      console.log("[Check] User categories:", formData.categories.length > 0 ? formData.categories.join(", ") : "none")
      console.log("[Check] =============================================")

      // Start progress animation
      const stepIds = ["queries", "chatgpt", "claude", "analysis", "recommendations"]
      let currentStepIndex = 0

      // Progress simulation while API runs
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
      }, 3000) // Move to next step every 3 seconds

      // Set first step as active
      setLoadingSteps((prev) =>
        prev.map((step, i) =>
          i === 0 ? { ...step, status: "active" } : step
        )
      )

      try {
        // Determine if user has a paid plan (for enhanced scanning)
        const isPaidPlan = subscription.plan === "pro" || subscription.plan === "starter"
        
        // Set a client-side timeout (5 minutes max for comprehensive AI analysis)
        const SCAN_TIMEOUT = 300000 // 5 minutes
        const timeoutId = setTimeout(() => {
          abortController.abort()
          throw new Error("Scan is taking too long. Please try again.")
        }, SCAN_TIMEOUT)
        
        const response = await fetch("/api/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            brandId,
            brandName: formData.brandName,
            brandUrl: formData.websiteUrl,
            description: formData.productDescription,
            category,
            categories: formData.categories,
            competitors: formData.competitors,
            customQueries: formData.customQueries,
            isPaidPlan, // Enable enhanced scanning for paid users
          }),
          signal: abortController.signal,
        })
        
        clearTimeout(timeoutId) // Clear timeout if response received

        clearInterval(progressInterval)

        if (!response.ok) {
          let errorMessage = "Scan failed"
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            // If response isn't JSON, try to get text
            try {
              const text = await response.text()
              if (text) errorMessage = text.slice(0, 100)
            } catch {
              // Ignore if we can't read the response
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

        // Save result to localStorage for dashboard
        // CRITICAL: User-provided brandName MUST be preserved
        // Category: use user selection if provided, otherwise use AI-detected from result
        const finalCategory = category || result.category || "Software"
        
        const scanDataToSave = {
          ...result,
          // Override with user-provided values - these should NEVER be changed
          brandName: formData.brandName,  // User's exact input
          brandUrl: formData.websiteUrl,
          description: formData.productDescription,
          category: finalCategory,  // User-selected OR AI-detected
          timestamp: new Date().toISOString(),
        }
        
        console.log("[Check] =============================================")
        console.log("[Check] SCAN COMPLETE - SAVING TO LOCALSTORAGE:")
        console.log("[Check] Brand Name being saved:", scanDataToSave.brandName)
        console.log("[Check] Category being saved:", scanDataToSave.category)
        console.log("[Check] Category source:", category ? "User selected" : "AI detected")
        console.log("[Check] Timestamp:", scanDataToSave.timestamp)
        console.log("[Check] =============================================")
        
        localStorage.setItem(SCAN_RESULT_KEY, JSON.stringify(scanDataToSave))
        
        // Verify it was saved correctly
        const verification = localStorage.getItem(SCAN_RESULT_KEY)
        if (verification) {
          const parsed = JSON.parse(verification)
          console.log("[Check] Verified localStorage brandName:", parsed.brandName)
        }

        // Clear form data
        localStorage.removeItem(FORM_STORAGE_KEY)

        // Mark free scan as used (for free tier users)
        if (subscription.plan === "free") {
          await subscription.markFreeScanUsed()
        }
        // Increment scan count for paid tiers
        if (subscription.plan === "starter") {
          await subscription.incrementScanCount()
        }

        // Complete all steps
        setLoadingSteps((prev) =>
          prev.map((step) => ({ ...step, status: "complete" }))
        )

        // Navigate to dashboard
        setTimeout(() => {
          router.push("/dashboard")
        }, 500)
      } catch (error) {
        clearInterval(progressInterval)
        
        if (error instanceof Error && error.name === "AbortError") {
          // Scan was cancelled
          return
        }

        console.error("Scan error:", error)
        
        // Mark current step as error
        setLoadingSteps((prev) =>
          prev.map((step) => 
            step.status === "active" ? { ...step, status: "error" } : step
          )
        )
        
        setScanError(
          error instanceof Error 
            ? error.message 
            : "Something went wrong. Please try again."
        )
      }
    }

    runScan()

    return () => {
      // Cleanup: abort any ongoing request
      if (scanAbortRef.current) {
        scanAbortRef.current.abort()
      }
    }
  }, [isLoading, router, formData, user])

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

  // Retry scan after error
  const handleRetry = () => {
    setScanError(null)
    setLoadingSteps((prev) =>
      prev.map((step) => ({ ...step, status: "pending" }))
    )
    // Trigger scan again
    setIsLoading(false)
    setTimeout(() => setIsLoading(true), 100)
  }

  // Cancel scan
  const handleCancel = () => {
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
                <div className="size-12 rounded-full bg-status-error/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="size-6 text-status-error" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Scan encountered an issue
                </h1>
                <p className="text-muted-foreground mb-6">
                  {scanError}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="secondary" onClick={handleCancel}>
                    Go back
                  </Button>
                  <Button onClick={handleRetry}>
                    Try again
                  </Button>
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
                    : loadingElapsed >= 90
                      ? "Almost there — finalizing your results..."
                      : loadingElapsed >= 60
                        ? "Taking a bit longer than usual — we're thoroughly analyzing the data"
                        : "This usually takes 30–60 seconds"
                  }
                </p>

                {!isSaving && (
                  <>
                    {/* Progress section */}
                    <div className="w-full max-w-xs mx-auto mb-8">
                      {/* Elapsed time and estimate */}
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          {Math.floor(loadingElapsed / 60)}:{String(loadingElapsed % 60).padStart(2, '0')} elapsed
                        </span>
                        <span className="text-muted-foreground">
                          {loadingElapsed < 30 
                            ? `~${Math.max(30 - loadingElapsed, 10)}s remaining`
                            : loadingElapsed < 60
                              ? "Almost done..."
                              : "Finishing up..."
                          }
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000 ease-out"
                          style={{ 
                            width: `${Math.min(
                              loadingElapsed < 10 ? loadingElapsed * 3 :
                              loadingElapsed < 30 ? 30 + (loadingElapsed - 10) * 2 :
                              loadingElapsed < 60 ? 70 + (loadingElapsed - 30) * 0.5 :
                              85 + Math.min((loadingElapsed - 60) * 0.2, 12),
                              97
                            )}%` 
                          }}
                        />
                      </div>
                      
                      {/* Percentage */}
                      <div className="text-center mt-2">
                        <span className="text-lg font-semibold text-foreground">
                          {Math.min(
                            loadingElapsed < 10 ? loadingElapsed * 3 :
                            loadingElapsed < 30 ? 30 + Math.floor((loadingElapsed - 10) * 2) :
                            loadingElapsed < 60 ? 70 + Math.floor((loadingElapsed - 30) * 0.5) :
                            85 + Math.min(Math.floor((loadingElapsed - 60) * 0.2), 12),
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

  // Form state
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
            Tell us about your product and we&apos;ll see how AI tools perceive it.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-10">
          {/* Step 1: Brand name */}
          <section className="space-y-6">
            <StepIndicator number={1} title="Your product" />
            <div className="space-y-2">
              <FormInput
                label="Brand name"
                placeholder="e.g., Notion, Figma, Slack"
                value={formData.brandName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, brandName: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Use your exact brand name as it appears on your website
              </p>
            </div>
          </section>

          {/* Step 2: Website */}
          <section className="space-y-6">
            <StepIndicator number={2} title="Your website" />
            <FormInput
              label="Website URL"
              placeholder="e.g., notion.so"
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
          </section>

          {/* Step 3: Product description */}
          <section className="space-y-6">
            <StepIndicator number={3} title="What you do" />
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">
                What does your product do?
              </Label>
              <textarea
                id="description"
                placeholder="e.g., Premium stock music licensing platform for video creators, filmmakers, and content creators with royalty-free music and sound effects"
                value={formData.productDescription}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    productDescription: e.target.value,
                  }))
                }
                rows={3}
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
                  Be specific — include your category, target audience, and key features
                </p>
                <DescriptionQuality length={formData.productDescription.length} />
              </div>
            </div>

            {queries.length > 0 && formData.productDescription.length > 10 && (
              <Card className="animate-fade-in">
                <CardContent className="py-5">
                  <p className="text-sm font-medium text-foreground mb-3">
                    We&apos;ll check how AI responds to:
                  </p>
                  <ul className="space-y-2">
                    {queries.map((query, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-center gap-2"
                      >
                        <span className="text-muted-foreground/50">•</span>
                        &quot;{query}&quot;
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Step 4: Categories */}
          <section className="space-y-6">
            <StepIndicator number={4} title="Search categories" />
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                What categories should AI search for?
              </Label>
              
              {formData.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.categories.map((category) => (
                    <span
                      key={category}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary font-medium"
                    >
                      {category}
                      <button
                        type="button"
                        onClick={() => removeCategory(category)}
                        className="text-primary/60 hover:text-primary transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {formData.categories.length < 3 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., yoga, fitness, activewear, banking, SEO, AI..."
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addCategory()
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
                    onClick={addCategory}
                    disabled={!categoryInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Add 1-3 categories your brand competes in — this helps AI ask the right questions
                {formData.categories.length > 0 && ` (${formData.categories.length}/3)`}
              </p>
              
              {/* Category suggestions */}
              {formData.categories.length < 3 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-2">Popular categories:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["yoga", "fitness", "running", "CrossFit", "golf", "banking", "SEO", "AI", "SaaS", "e-commerce", "fashion", "beauty", "food", "travel"].map((suggestion) => (
                      !formData.categories.map(c => c.toLowerCase()).includes(suggestion.toLowerCase()) && (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            if (formData.categories.length < 3) {
                              setFormData((prev) => ({
                                ...prev,
                                categories: [...prev.categories, suggestion],
                              }))
                            }
                          }}
                          className="px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                        >
                          {suggestion}
                        </button>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Step 5: Competitors */}
          <section className="space-y-6">
            <StepIndicator number={5} title="Competitors" optional />
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Competitors to compare
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

              {formData.competitors.length < 3 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Asana, Monday.com, ClickUp"
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
                Add direct competitors users compare you to — we&apos;ll also discover others automatically
                {formData.competitors.length > 0 && ` (${formData.competitors.length}/3)`}
              </p>
            </div>
          </section>

          {/* Step 6: Custom Queries */}
          <section className="space-y-6">
            <StepIndicator number={6} title="Custom queries" optional />
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                What questions do your customers ask?
              </Label>
              
              {formData.customQueries.length > 0 && (
                <div className="space-y-2">
                  {formData.customQueries.map((query) => (
                    <div
                      key={query}
                      className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm text-foreground"
                    >
                      <span className="flex-1">&quot;{query}&quot;</span>
                      <button
                        type="button"
                        onClick={() => removeCustomQuery(query)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {formData.customQueries.length < 2 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Best tool for managing remote teams"
                    value={customQueryInput}
                    onChange={(e) => setCustomQueryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addCustomQuery()
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
                    onClick={addCustomQuery}
                    disabled={!customQueryInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Add 1-2 specific questions your ideal customers would ask AI
                {formData.customQueries.length > 0 && ` (${formData.customQueries.length}/2)`}
              </p>
            </div>
          </section>

          {/* Pro tips section */}
          <section className="pt-2">
            <Card className="bg-muted/30 border-border/50">
              <CardContent className="py-4">
                <p className="text-xs font-medium text-foreground mb-2">
                  💡 Tips for better results
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span><strong>Description:</strong> Include your category, target audience, and what makes you different</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span><strong>Competitors:</strong> Add 1-3 brands users directly compare you to</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span><strong>Brand name:</strong> Use your exact name as it appears on your site</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
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
              Check my visibility
              <ArrowRight className="ml-1" />
            </Button>
            {!isFormValid && (
              <p className="text-sm text-muted-foreground text-center mt-3">
                Fill in all required fields to continue
              </p>
            )}
            {/* Show message if user has used free scan */}
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

function DescriptionQuality({ length }: { length: number }) {
  if (length === 0) return null
  
  if (length < 30) {
    return (
      <span className="text-xs text-status-error">
        Too short — add more detail
      </span>
    )
  }
  
  if (length < 60) {
    return (
      <span className="text-xs text-status-warning">
        Good start — a bit more detail helps
      </span>
    )
  }
  
  if (length < 150) {
    return (
      <span className="text-xs text-status-success">
        Great length
      </span>
    )
  }
  
  return (
    <span className="text-xs text-muted-foreground">
      {length} characters
    </span>
  )
}
