"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  ArrowRight,
  X,
  Info,
  Sparkles,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const PUBLIC_FORM_STORAGE_KEY = "mentioned_public_scan_form"

interface FormData {
  brandName: string
  websiteUrl: string
  coreProblem: string
  targetBuyer: string
  differentiators: string
  competitors: string[]
  buyerQuestions: string
  email: string
}

const EMPTY_FORM: FormData = {
  brandName: "",
  websiteUrl: "",
  coreProblem: "",
  targetBuyer: "",
  differentiators: "",
  competitors: [],
  buyerQuestions: "",
  email: "",
}

const PUBLIC_SCAN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SCAN === "true"

export default function PublicScanPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [competitorInput, setCompetitorInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Logged-in users → redirect to /check (their tracked workflow) ──
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/check")
    }
  }, [user, authLoading, router])

  // Restore drafts so accidental refreshes don't lose progress.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PUBLIC_FORM_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === "object") {
          setFormData({ ...EMPTY_FORM, ...parsed })
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (
      formData.brandName ||
      formData.websiteUrl ||
      formData.coreProblem
    ) {
      try {
        localStorage.setItem(PUBLIC_FORM_STORAGE_KEY, JSON.stringify(formData))
      } catch {
        /* ignore quota errors */
      }
    }
  }, [formData])

  const isValidUrl = (url: string) => {
    if (!url) return false
    const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}|^https?:\/\/.+/
    return pattern.test(url)
  }

  const isValidEmail = (email: string) => {
    if (!email) return true // optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const isFormValid =
    formData.brandName.trim().length > 0 &&
    isValidUrl(formData.websiteUrl) &&
    formData.coreProblem.trim().length >= 15 &&
    formData.targetBuyer.trim().length >= 8 &&
    isValidEmail(formData.email)

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

  const removeCompetitor = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      competitors: prev.competitors.filter((c) => c !== name),
    }))
  }

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      let normalizedUrl = formData.websiteUrl.trim()
      if (!normalizedUrl.startsWith("http")) {
        normalizedUrl = "https://" + normalizedUrl
      }

      const buyerQuestions = formData.buyerQuestions
        .split("\n")
        .map((q) => q.trim())
        .filter((q) => q.length >= 10)
        .slice(0, 10)

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: formData.brandName.trim(),
          brandUrl: normalizedUrl,
          coreProblem: formData.coreProblem.trim(),
          targetBuyer: formData.targetBuyer.trim(),
          differentiators: formData.differentiators.trim() || undefined,
          competitors: formData.competitors,
          buyerQuestions: buyerQuestions.length > 0 ? buyerQuestions : undefined,
          source: "public",
          leadEmail: formData.email.trim() || undefined,
        }),
      })

      if (!response.ok) {
        let msg = "Scan failed. Please try again."
        try {
          const data = await response.json()
          if (data?.error) msg = String(data.error)
        } catch {
          /* ignore */
        }
        throw new Error(msg)
      }

      const data = await response.json()

      // Both queued and sync responses include an id we can route to.
      // Sync mode returns _scanId (legacy field), queued returns scanId.
      const id = data.scanId || data._scanId
      if (!id) throw new Error("No scan ID returned. Please try again.")

      try {
        localStorage.removeItem(PUBLIC_FORM_STORAGE_KEY)
      } catch {
        /* ignore */
      }

      router.push(`/scan/${id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setSubmitError(msg)
      setSubmitting(false)
    }
  }, [formData, isFormValid, submitting, router])

  // Feature flag: hide entirely if disabled.
  if (!PUBLIC_SCAN_ENABLED) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">
            Coming soon
          </h1>
          <p className="text-gray-600 mb-6">
            Public scans are currently in setup. Sign up to run a free scan
            today.
          </p>
          <Link href="/check">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              Run a scan with an account
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Avoid flicker for logged-in users who are about to be redirected.
  if (authLoading || user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="size-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-2xl px-6">
          <div className="flex h-14 items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
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
              <span className="font-semibold text-gray-900 text-sm">
                Mentioned
              </span>
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Check your AI visibility — free
          </h1>
          <p className="text-gray-600 mt-2">
            See how ChatGPT and Claude describe your product.
            No signup. Results in about 2 minutes.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-10 space-y-10">
          {/* STEP 1 — Product */}
          <section className="space-y-6">
            <StepIndicator number={1} title="Your product" />

            <div className="space-y-2">
              <FormInput
                label="Brand name"
                placeholder="e.g., Notion, Linear, Cal.com"
                value={formData.brandName}
                maxLength={80}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, brandName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <FormInput
                label="Website URL"
                placeholder="https://yourproduct.com"
                value={formData.websiteUrl}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, websiteUrl: e.target.value }))
                }
                error={
                  formData.websiteUrl && !isValidUrl(formData.websiteUrl)
                    ? "Please enter a valid URL"
                    : undefined
                }
              />
              <p className="text-xs text-gray-500 mt-1.5">
                We&apos;ll scan your site to build your AI visibility profile.
              </p>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* STEP 2 — Market */}
          <section className="space-y-6">
            <StepIndicator number={2} title="Your market" />

            <div className="space-y-2">
              <Label
                htmlFor="coreProblem"
                className="text-sm font-semibold text-gray-800"
              >
                What problem does your product solve? *
              </Label>
              <textarea
                id="coreProblem"
                placeholder="e.g., Teams waste hours coordinating schedules. We eliminate the back-and-forth."
                value={formData.coreProblem}
                maxLength={300}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, coreProblem: e.target.value }))
                }
                rows={2}
                className={cn(
                  "flex w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 transition-all duration-200",
                  "placeholder:text-gray-400",
                  "hover:border-gray-400",
                  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                  "resize-none",
                )}
              />
              <p className="text-xs text-gray-500 mt-1.5">
                The clearer this is, the better the AI queries we test against.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="targetBuyer"
                className="text-sm font-semibold text-gray-800"
              >
                Who is your ideal customer? *
              </Label>
              <input
                id="targetBuyer"
                type="text"
                placeholder="e.g., Remote-first startup founders with 10–50 employees"
                value={formData.targetBuyer}
                maxLength={150}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, targetBuyer: e.target.value }))
                }
                className={cn(
                  "flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-900 transition-all duration-200",
                  "placeholder:text-gray-400",
                  "hover:border-gray-400",
                  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="differentiators"
                  className="text-sm font-semibold text-gray-800"
                >
                  What makes you different?
                </Label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-[11px] text-blue-600 font-semibold">
                  <Sparkles className="size-3" />
                  Recommended
                </span>
              </div>
              <textarea
                id="differentiators"
                placeholder="e.g., Only scheduling tool with native async video. No login required for invitees."
                value={formData.differentiators}
                maxLength={300}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    differentiators: e.target.value,
                  }))
                }
                rows={2}
                className={cn(
                  "flex w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 transition-all duration-200",
                  "placeholder:text-gray-400",
                  "hover:border-gray-400",
                  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                  "resize-none",
                )}
              />
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* STEP 3 — Competitors (optional) */}
          <section className="space-y-6">
            <StepIndicator number={3} title="Competitors" optional />

            <div className="space-y-3">
              {formData.competitors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.competitors.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-800"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCompetitor(c)}
                        className="text-gray-500 hover:text-gray-900 transition-colors"
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
                    placeholder="e.g., Calendly, SavvyCal"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addCompetitor()
                      }
                    }}
                    className={cn(
                      "flex h-11 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-900 transition-all duration-200",
                      "placeholder:text-gray-400",
                      "hover:border-gray-400",
                      "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
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

              <p className="text-xs text-gray-500">
                We&apos;ll auto-detect competitors too — naming yours improves
                accuracy.
              </p>
            </div>
          </section>

          {/* Helper hint */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Info className="size-4 flex-shrink-0" />
            <span>Mentioned works best for software products and SaaS tools.</span>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <Button
              size="xl"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm disabled:opacity-50"
              disabled={!isFormValid || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-5 animate-spin mr-2" />
                  Starting scan…
                </>
              ) : (
                <>
                  Run free AI visibility scan
                  <ArrowRight className="ml-1" />
                </>
              )}
            </Button>

            {!isFormValid && !submitting && (
              <p className="text-sm text-gray-500 text-center mt-3">
                {!formData.brandName.trim()
                  ? "Enter your brand name to continue"
                  : !isValidUrl(formData.websiteUrl)
                  ? "Enter a valid website URL"
                  : formData.coreProblem.trim().length < 15
                  ? "Describe the problem your product solves (15+ characters)"
                  : formData.targetBuyer.trim().length < 8
                  ? "Describe your target customer (8+ characters)"
                  : !isValidEmail(formData.email)
                  ? "Email looks invalid (or leave blank)"
                  : "Fill in all required fields"}
              </p>
            )}

            {submitError && (
              <p className="text-sm text-red-600 text-center mt-3">
                {submitError}
              </p>
            )}

            {/* Optional email — placed BELOW the button per spec */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-gray-700"
              >
                Email me a copy of the results{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                className={cn(
                  "mt-2 flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-900 transition-all duration-200",
                  "placeholder:text-gray-400",
                  "hover:border-gray-400",
                  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                )}
              />
              <p className="text-xs text-gray-500 mt-2">
                We&apos;ll never share or sell your email.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Free public scan · No credit card required ·{" "}
          <Link href="/login" className="underline hover:text-gray-600">
            Log in
          </Link>{" "}
          to track changes over time
        </p>
      </main>
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
      <span className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-base font-bold text-blue-600">
        {number}
      </span>
      <span className="text-base font-semibold text-gray-900">{title}</span>
      {optional && (
        <span className="text-xs text-gray-500">(optional)</span>
      )}
    </div>
  )
}
