"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Loader2 } from "lucide-react"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isConfigured } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // If Supabase is not configured, allow access (development mode)
    if (!isConfigured) return

    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router, isConfigured])

  // Show loading state while checking auth
  if (loading && isConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 text-muted-foreground animate-spin" />
      </div>
    )
  }

  // If Supabase is not configured, allow access (development mode)
  if (!isConfigured) {
    return <>{children}</>
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!user) {
    return null
  }

  return <>{children}</>
}
