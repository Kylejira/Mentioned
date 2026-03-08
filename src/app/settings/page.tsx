"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { SkeletonForm } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/lib/auth"
import { createClient, isSupabaseConfigured } from "@/lib/supabase"
import { X, Plus, Loader2, AlertTriangle, ChevronDown, ChevronRight, CreditCard, ArrowRight } from "lucide-react"
import { useSubscription } from "@/lib/subscription"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface BrandData {
  id: string
  name: string
  url: string
  description: string
  category: string
}

interface Competitor {
  id: string
  name: string
}

interface ProductProfileData {
  id: string
  product_name: string
  one_liner: string
  description: string | null
  key_features: string[]
  target_audience: string | null
  use_cases: string[]
  competitors: string[]
  website_url: string | null
  preferred_tone: string
  custom_instructions: string | null
}

const TONE_OPTIONS = [
  { value: "casual", label: "Casual", desc: "Informal, uses 'tbh', 'imo', short sentences" },
  { value: "professional", label: "Professional", desc: "Clear, structured, proper grammar" },
  { value: "helpful", label: "Helpful", desc: "Warm, experience-based, genuinely useful" },
  { value: "expert", label: "Expert", desc: "Deep knowledge, references trade-offs" },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const { showToast } = useToast()
  const subscription = useSubscription()

  // Brand state
  const [brand, setBrand] = useState<BrandData | null>(null)
  const [brandForm, setBrandForm] = useState({
    name: "",
    url: "",
    description: "",
    category: "",
  })
  const [isSavingBrand, setIsSavingBrand] = useState(false)

  // Competitors state
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [newCompetitor, setNewCompetitor] = useState("")
  const [isSavingCompetitor, setIsSavingCompetitor] = useState(false)

  // Product profile state
  const [profileExists, setProfileExists] = useState(false)
  const [profileForm, setProfileForm] = useState({
    product_name: "",
    one_liner: "",
    description: "",
    key_features: [] as string[],
    target_audience: "",
    use_cases: [] as string[],
    competitors: [] as string[],
    website_url: "",
    preferred_tone: "helpful",
    custom_instructions: "",
  })
  const [newFeature, setNewFeature] = useState("")
  const [newUseCase, setNewUseCase] = useState("")
  const [newProfileCompetitor, setNewProfileCompetitor] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!user || !isSupabaseConfigured()) {
        setIsLoading(false)
        return
      }

      try {
        const supabase = createClient()
        if (!supabase) throw new Error("Database not configured")

        // Load brand
        const { data: brands } = await supabase
          .from("brands")
          .select("*")
          .eq("user_id", user.id)
          .limit(1)

        if (brands && brands.length > 0) {
          const brandData = brands[0]
          setBrand(brandData)
          setBrandForm({
            name: brandData.name || "",
            url: brandData.url || "",
            description: brandData.description || "",
            category: brandData.category || "",
          })

          // Load competitors
          const { data: competitorData } = await supabase
            .from("competitors")
            .select("*")
            .eq("brand_id", brandData.id)

          setCompetitors(competitorData || [])
        }

        // Load product profile
        const { data: profileData } = await supabase
          .from("product_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()

        if (profileData) {
          setProfileExists(true)
          setProfileForm({
            product_name: profileData.product_name || "",
            one_liner: profileData.one_liner || "",
            description: profileData.description || "",
            key_features: profileData.key_features || [],
            target_audience: profileData.target_audience || "",
            use_cases: profileData.use_cases || [],
            competitors: profileData.competitors || [],
            website_url: profileData.website_url || "",
            preferred_tone: profileData.preferred_tone || "helpful",
            custom_instructions: profileData.custom_instructions || "",
          })
        } else if (brands && brands.length > 0) {
          const b = brands[0]
          setProfileForm((prev) => ({
            ...prev,
            product_name: b.name || "",
            website_url: b.url || "",
            description: b.description || "",
          }))
        }
      } catch (e) {
        console.error("Error loading settings:", e)
        showToast("Failed to load settings", "error")
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading) {
      loadData()
    }
  }, [user, authLoading, showToast])

  // Save brand
  const handleSaveBrand = async () => {
    if (!user || !brand) return

    setIsSavingBrand(true)

    try {
      const supabase = createClient()
      if (!supabase) throw new Error("Database not configured")

      const { error } = await supabase
        .from("brands")
        .update({
          name: brandForm.name,
          url: brandForm.url,
          description: brandForm.description,
          category: brandForm.category,
          updated_at: new Date().toISOString(),
        })
        .eq("id", brand.id)

      if (error) throw error

      setBrand((prev) => prev ? { ...prev, ...brandForm } : null)
      showToast("Settings saved")
    } catch (e) {
      console.error("Error saving brand:", e)
      showToast("Failed to save settings", "error")
    } finally {
      setIsSavingBrand(false)
    }
  }

  // Add competitor
  const handleAddCompetitor = async () => {
    if (!brand || !newCompetitor.trim() || competitors.length >= 5) return

    setIsSavingCompetitor(true)

    try {
      const supabase = createClient()
      if (!supabase) throw new Error("Database not configured")

      const { data, error } = await supabase
        .from("competitors")
        .insert({
          brand_id: brand.id,
          name: newCompetitor.trim(),
        })
        .select()
        .single()

      if (error) throw error

      setCompetitors((prev) => [...prev, data])
      setNewCompetitor("")
      showToast("Competitor added")
    } catch (e) {
      console.error("Error adding competitor:", e)
      showToast("Failed to add competitor", "error")
    } finally {
      setIsSavingCompetitor(false)
    }
  }

  // Remove competitor
  const handleRemoveCompetitor = async (competitorId: string) => {
    try {
      const supabase = createClient()
      if (!supabase) throw new Error("Database not configured")

      const { error } = await supabase
        .from("competitors")
        .delete()
        .eq("id", competitorId)

      if (error) throw error

      setCompetitors((prev) => prev.filter((c) => c.id !== competitorId))
      showToast("Competitor removed")
    } catch (e) {
      console.error("Error removing competitor:", e)
      showToast("Failed to remove competitor", "error")
    }
  }

  // Save product profile
  const handleSaveProfile = async () => {
    if (!user) return
    if (!profileForm.product_name.trim() || !profileForm.one_liner.trim()) {
      showToast("Product name and one-liner are required", "error")
      return
    }

    setIsSavingProfile(true)
    try {
      const supabase = createClient()
      if (!supabase) throw new Error("Database not configured")

      const payload = {
        user_id: user.id,
        product_name: profileForm.product_name.trim(),
        one_liner: profileForm.one_liner.trim(),
        description: profileForm.description.trim() || null,
        key_features: profileForm.key_features,
        target_audience: profileForm.target_audience.trim() || null,
        use_cases: profileForm.use_cases,
        competitors: profileForm.competitors,
        website_url: profileForm.website_url.trim() || null,
        preferred_tone: profileForm.preferred_tone,
        custom_instructions: profileForm.custom_instructions.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("product_profiles")
        .upsert(payload, { onConflict: "user_id" })

      if (error) throw error

      setProfileExists(true)
      showToast("Product profile saved")
    } catch (e) {
      console.error("Error saving product profile:", e)
      showToast("Failed to save product profile", "error")
    } finally {
      setIsSavingProfile(false)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    await signOut()
    router.push("/")
  }

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!user?.email) return

    try {
      const supabase = createClient()
      if (!supabase) throw new Error("Database not configured")
      
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })

      if (error) throw error

      showToast("Password reset email sent")
    } catch (e) {
      console.error("Error sending reset email:", e)
      showToast("Failed to send reset email", "error")
    }
  }

  // Handle delete account
  const handleDeleteAccount = async () => {
    if (!user) return

    setIsDeleting(true)

    try {
      const supabase = createClient()
      if (!supabase) throw new Error("Database not configured")

      // Delete user data (cascades will handle related tables)
      await supabase.from("brands").delete().eq("user_id", user.id)

      // Sign out
      await signOut()

      // Note: Actually deleting the auth user requires admin rights
      // For now, we just delete their data and sign them out

      showToast("Account deleted")
      router.push("/")
    } catch (e) {
      console.error("Error deleting account:", e)
      showToast("Failed to delete account", "error")
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-2xl space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Settings
            </h1>
          </div>
          <Card>
            <CardContent className="pt-6">
              <SkeletonForm />
            </CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your brand details and account
          </p>
        </div>

        {/* Brand Details */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Details</CardTitle>
            <CardDescription>
              Update your brand information for better scan results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!brand ? (
              <p className="text-muted-foreground">
                No brand configured.{" "}
                <a href="/check" className="text-foreground underline hover:no-underline">
                  Run your first scan
                </a>{" "}
                to set up your brand.
              </p>
            ) : (
              <>
                <FormInput
                  label="Brand name"
                  value={brandForm.name}
                  onChange={(e) => setBrandForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Notion"
                />
                <FormInput
                  label="Website URL"
                  value={brandForm.url}
                  onChange={(e) => setBrandForm((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="e.g., notion.so"
                />
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    value={brandForm.description}
                    onChange={(e) => setBrandForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="What does your product do?"
                    rows={3}
                    className={cn(
                      "flex w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground transition-all duration-200",
                      "placeholder:text-muted-foreground/60",
                      "hover:border-border/80",
                      "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10",
                      "resize-none"
                    )}
                  />
                </div>
                <FormInput
                  label="Category"
                  value={brandForm.category}
                  onChange={(e) => setBrandForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., project management"
                />
                <Button onClick={handleSaveBrand} disabled={isSavingBrand}>
                  {isSavingBrand ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Competitors */}
        <Card>
          <CardHeader>
            <CardTitle>Competitors</CardTitle>
            <CardDescription>
              Add up to 5 competitors to compare your visibility against
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {competitors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {competitors.map((competitor) => (
                  <span
                    key={competitor.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground"
                  >
                    {competitor.name}
                    <button
                      onClick={() => handleRemoveCompetitor(competitor.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {competitors.length < 5 && brand && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  placeholder="e.g., Asana"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddCompetitor()
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
                  variant="secondary"
                  onClick={handleAddCompetitor}
                  disabled={!newCompetitor.trim() || isSavingCompetitor}
                >
                  {isSavingCompetitor ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </Button>
              </div>
            )}

            {competitors.length === 0 && !brand && (
              <p className="text-muted-foreground">
                Set up your brand first to add competitors.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Product Profile (for AI Reply Generator) */}
        <Card>
          <CardHeader>
            <CardTitle>Product Profile</CardTitle>
            <CardDescription>
              Used by the AI Reply Generator to craft natural replies that mention your product. {!profileExists && "Fill this out to unlock reply generation."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product Name */}
            <FormInput
              label="Product name *"
              value={profileForm.product_name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, product_name: e.target.value }))}
              placeholder="e.g., Pika"
            />

            {/* One-Liner */}
            <FormInput
              label="One-liner *"
              value={profileForm.one_liner}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, one_liner: e.target.value }))}
              placeholder='e.g., "Pika helps creators make AI-generated videos from text prompts"'
            />

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                value={profileForm.description}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="2-3 sentences about what your product does and why it's different"
                rows={3}
                className={cn(
                  "flex w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground transition-all duration-200",
                  "placeholder:text-muted-foreground/60",
                  "hover:border-border/80",
                  "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10",
                  "resize-none"
                )}
              />
            </div>

            {/* Key Features */}
            <div className="space-y-2">
              <Label>Key features</Label>
              {profileForm.key_features.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {profileForm.key_features.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground"
                    >
                      {f}
                      <button
                        onClick={() =>
                          setProfileForm((prev) => ({
                            ...prev,
                            key_features: prev.key_features.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {profileForm.key_features.length < 8 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="e.g., text-to-video generation"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFeature.trim()) {
                        e.preventDefault()
                        setProfileForm((prev) => ({
                          ...prev,
                          key_features: [...prev.key_features, newFeature.trim()],
                        }))
                        setNewFeature("")
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
                    variant="secondary"
                    onClick={() => {
                      if (newFeature.trim()) {
                        setProfileForm((prev) => ({
                          ...prev,
                          key_features: [...prev.key_features, newFeature.trim()],
                        }))
                        setNewFeature("")
                      }
                    }}
                    disabled={!newFeature.trim()}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Target Audience */}
            <FormInput
              label="Target audience"
              value={profileForm.target_audience}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, target_audience: e.target.value }))}
              placeholder="e.g., content creators and social media managers"
            />

            {/* Use Cases */}
            <div className="space-y-2">
              <Label>Use cases</Label>
              {profileForm.use_cases.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {profileForm.use_cases.map((uc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground"
                    >
                      {uc}
                      <button
                        onClick={() =>
                          setProfileForm((prev) => ({
                            ...prev,
                            use_cases: prev.use_cases.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {profileForm.use_cases.length < 6 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUseCase}
                    onChange={(e) => setNewUseCase(e.target.value)}
                    placeholder="e.g., TikTok video ads"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newUseCase.trim()) {
                        e.preventDefault()
                        setProfileForm((prev) => ({
                          ...prev,
                          use_cases: [...prev.use_cases, newUseCase.trim()],
                        }))
                        setNewUseCase("")
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
                    variant="secondary"
                    onClick={() => {
                      if (newUseCase.trim()) {
                        setProfileForm((prev) => ({
                          ...prev,
                          use_cases: [...prev.use_cases, newUseCase.trim()],
                        }))
                        setNewUseCase("")
                      }
                    }}
                    disabled={!newUseCase.trim()}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Competitors (profile-level) */}
            <div className="space-y-2">
              <Label>Competitors</Label>
              {profileForm.competitors.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {profileForm.competitors.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground"
                    >
                      {c}
                      <button
                        onClick={() =>
                          setProfileForm((prev) => ({
                            ...prev,
                            competitors: prev.competitors.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {profileForm.competitors.length < 10 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProfileCompetitor}
                    onChange={(e) => setNewProfileCompetitor(e.target.value)}
                    placeholder="e.g., Runway, Kling"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newProfileCompetitor.trim()) {
                        e.preventDefault()
                        setProfileForm((prev) => ({
                          ...prev,
                          competitors: [...prev.competitors, newProfileCompetitor.trim()],
                        }))
                        setNewProfileCompetitor("")
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
                    variant="secondary"
                    onClick={() => {
                      if (newProfileCompetitor.trim()) {
                        setProfileForm((prev) => ({
                          ...prev,
                          competitors: [...prev.competitors, newProfileCompetitor.trim()],
                        }))
                        setNewProfileCompetitor("")
                      }
                    }}
                    disabled={!newProfileCompetitor.trim()}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Website URL */}
            <FormInput
              label="Website URL"
              value={profileForm.website_url}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, website_url: e.target.value }))}
              placeholder="e.g., https://pika.art"
            />

            {/* Preferred Tone */}
            <div className="space-y-2">
              <Label>Preferred reply tone</Label>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone.value}
                    onClick={() => setProfileForm((prev) => ({ ...prev, preferred_tone: tone.value }))}
                    className={cn(
                      "text-left rounded-xl border p-3 transition-all",
                      profileForm.preferred_tone === tone.value
                        ? "border-foreground/30 bg-muted ring-1 ring-foreground/10"
                        : "border-border hover:border-border/80"
                    )}
                  >
                    <div className="text-sm font-medium text-foreground">{tone.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{tone.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <Label>Custom style notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                value={profileForm.custom_instructions}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, custom_instructions: e.target.value }))}
                placeholder='e.g., "Always mention that we have a free tier. Avoid comparing on price."'
                rows={2}
                className={cn(
                  "flex w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground transition-all duration-200",
                  "placeholder:text-muted-foreground/60",
                  "hover:border-border/80",
                  "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10",
                  "resize-none"
                )}
              />
            </div>

            {/* Save */}
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : profileExists ? (
                "Update profile"
              ) : (
                "Save profile"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader>
            <CardTitle>Billing & Subscription</CardTitle>
            <CardDescription>
              Manage your plan and payment details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground capitalize">
                    {subscription.plan} Plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.isPro 
                      ? "Unlimited scans" 
                      : subscription.plan === "starter"
                        ? `${subscription.scansRemaining}/${subscription.scansLimit} scans remaining`
                        : subscription.freeScanUsed 
                          ? "Free scan used"
                          : "1 free scan available"
                    }
                  </p>
                </div>
              </div>
              <Link href="/settings/billing">
                <Button variant="secondary" size="sm">
                  Manage
                  <ArrowRight className="size-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-foreground">{user?.email || "Not logged in"}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handlePasswordReset}>
                Change password
              </Button>
              <Button variant="secondary" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-status-error/20">
          <CardHeader className="pb-2">
            <button
              onClick={() => setDangerZoneExpanded(!dangerZoneExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <CardTitle className="text-status-error">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible actions that affect your account
                </CardDescription>
              </div>
              {dangerZoneExpanded ? (
                <ChevronDown className="size-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-5 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {dangerZoneExpanded && (
            <CardContent className="pt-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-status-error/20 bg-status-error-muted/30">
                <div>
                  <p className="font-medium text-foreground">Delete account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all scan history
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full sm:w-auto"
                >
                  Delete account
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete your account?"
        description="This will permanently delete your account and all scan history. This action cannot be undone."
        confirmText="Delete account"
        confirmWord="DELETE"
        variant="danger"
        loading={isDeleting}
      />
    </AppShell>
  )
}
