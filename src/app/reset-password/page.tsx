"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react"

function ResetPasswordContent() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // If no user session after auth loads, the recovery link was invalid or expired
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      setSessionChecked(true)
    }
  }, [authLoading])

  const passwordValid = password.length >= 8
  const passwordsMatch = password === confirmPassword
  const isFormValid = passwordValid && passwordsMatch && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!passwordValid) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.")
      return
    }

    if (!supabase) {
      setError("Authentication is not configured.")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      if (updateError.message.includes("same")) {
        setError("New password must be different from your current password.")
      } else if (updateError.message.includes("weak") || updateError.message.includes("short")) {
        setError("Password is too weak. Please choose a stronger password.")
      } else {
        setError(updateError.message || "Something went wrong. Please try again.")
      }
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  // Loading state
  if (authLoading || !sessionChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 text-muted-foreground animate-spin" />
      </div>
    )
  }

  // No session — recovery link expired or invalid
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="mb-8">
          <Image
            src="/logo.png"
            alt="Mentioned"
            width={40}
            height={40}
            className="rounded-xl"
          />
        </Link>

        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-6 text-center">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Link expired
            </h1>
            <p className="text-muted-foreground mb-6">
              This password reset link has expired or is invalid. Please request a new one.
            </p>
            <Link href="/forgot-password">
              <Button className="w-full">Request new link</Button>
            </Link>
            <Link
              href="/login"
              className="block mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="size-12 rounded-full bg-status-success-muted flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="size-6 text-status-success" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Password updated
            </h1>
            <p className="text-muted-foreground mb-6">
              Your password has been changed successfully. You&apos;re now logged in.
            </p>
            <Button className="w-full" onClick={() => router.push("/dashboard")}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Reset form
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <Link href="/" className="mb-8">
        <Image
          src="/logo.png"
          alt="Mentioned"
          width={40}
          height={40}
          className="rounded-xl"
        />
      </Link>

      {/* Card */}
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8 pb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="size-10 rounded-full bg-accent flex items-center justify-center">
              <ShieldCheck className="size-5 text-accent-foreground" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-foreground text-center mb-2">
            Set new password
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Choose a strong password with at least 8 characters.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div className="relative">
              <FormInput
                label="New password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {/* Password strength hint */}
            {password.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      password.length >= 12
                        ? "w-full bg-status-success"
                        : password.length >= 8
                          ? "w-2/3 bg-status-warning"
                          : "w-1/3 bg-status-error"
                    }`}
                  />
                </div>
                <span
                  className={`text-xs font-medium ${
                    password.length >= 12
                      ? "text-status-success"
                      : password.length >= 8
                        ? "text-status-warning-foreground"
                        : "text-status-error"
                  }`}
                >
                  {password.length >= 12
                    ? "Strong"
                    : password.length >= 8
                      ? "Good"
                      : "Too short"}
                </span>
              </div>
            )}

            {/* Confirm password */}
            <div className="relative">
              <FormInput
                label="Confirm new password"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-[34px] text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {/* Mismatch warning */}
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-status-error">
                Passwords do not match.
              </p>
            )}

            {error && <p className="text-sm text-status-error">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={!isFormValid || loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="size-8 text-muted-foreground animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
