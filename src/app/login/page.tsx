"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, user, loading: authLoading } = useAuth()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = searchParams.get("redirect") || "/dashboard"

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push(redirectTo)
    }
  }, [user, authLoading, router, redirectTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await signIn(email, password)

      if (error) {
        setError(getErrorMessage(error.message))
        setLoading(false)
      } else {
        router.push(redirectTo)
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
            Welcome back
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
              autoComplete="current-password"
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
                "Log in"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Sign up link */}
      <p className="mt-6 text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup${redirectTo !== "/dashboard" ? `?redirect=${redirectTo}` : ""}`}
          className="text-foreground font-medium hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}

function getErrorMessage(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Incorrect email or password"
  }
  if (message.includes("Email not confirmed")) {
    return "Please check your email to confirm your account"
  }
  if (message.includes("invalid") || message.includes("400")) {
    return "Unable to sign in. Please check your credentials."
  }
  return "Something went wrong. Please try again."
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 text-muted-foreground animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
