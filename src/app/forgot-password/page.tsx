"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await resetPassword(email)

    if (error) {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  const isFormValid = email.trim() !== ""

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
              We sent a password reset link to <strong className="text-foreground">{email}</strong>
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
          <h1 className="text-2xl font-semibold text-foreground text-center mb-2">
            Reset your password
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Enter your email and we&apos;ll send you a reset link
          </p>

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
                "Send reset link"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Back to login */}
      <Link
        href="/login"
        className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        Back to login
      </Link>
    </div>
  )
}
