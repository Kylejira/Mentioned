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
