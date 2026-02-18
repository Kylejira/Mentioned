"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2 } from "lucide-react"

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signUp, user, loading: authLoading } = useAuth()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const redirectTo = searchParams.get("redirect") || "/dashboard"

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = redirectTo
    }
  }, [user, authLoading, redirectTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validate password
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    try {
      const { error, session } = await signUp(email, password)

      if (error) {
        setError(getErrorMessage(error.message))
        setLoading(false)
      } else if (session) {
        window.location.href = redirectTo
      } else {
        setSuccess(true)
        setLoading(false)
      }
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  const isFormValid = email.trim() !== "" && password.trim() !== ""

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 text-muted-foreground animate-spin" />
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
              Check your email
            </h1>
            <p className="text-muted-foreground mb-6">
              We sent a confirmation link to <strong className="text-foreground">{email}</strong>
            </p>
            <Link href="/login">
              <Button variant="secondary" className="w-full">
                Back to login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

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
          <h1 className="text-2xl font-semibold text-foreground text-center mb-6">
            Create your account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />

            <FormInput
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              helperText="At least 6 characters"
            />

            {error && (
              <p className="text-sm text-status-error">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!isFormValid || loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Login link */}
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login${redirectTo !== "/dashboard" ? `?redirect=${redirectTo}` : ""}`}
          className="text-foreground font-medium hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  )
}

function getErrorMessage(message: string): string {
  if (message.includes("User already registered")) {
    return "An account with this email already exists"
  }
  if (message.includes("Invalid email")) {
    return "Please enter a valid email address"
  }
  return "Something went wrong. Please try again."
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 text-muted-foreground animate-spin" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}
