import { createBrowserClient } from "@supabase/ssr"

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    // Return a mock client for development when Supabase is not configured
    return null
  }

  return createBrowserClient(url, anonKey)
}

// Subscription types
export type SubscriptionStatus = "free" | "pro" | "enterprise"

// Database types
export type Brand = {
  id: string
  user_id: string
  name: string
  url: string
  description: string | null
  category: string | null
  created_at: string
  updated_at: string
  // Subscription fields
  subscription_status: SubscriptionStatus
  free_scan_used: boolean
  subscription_expires_at: string | null
}

export type Competitor = {
  id: string
  brand_id: string
  name: string
  created_at: string
}

export type Scan = {
  id: string
  brand_id: string
  status: "not_mentioned" | "low_visibility" | "recommended"
  sources: Record<string, unknown> | null
  queries_tested: Record<string, unknown>[] | null
  signals: Record<string, unknown>[] | null
  actions: Record<string, unknown>[] | null
  competitor_results: Record<string, unknown>[] | null
  created_at: string
}
