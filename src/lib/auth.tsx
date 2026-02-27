"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { User, AuthError, Session } from "@supabase/supabase-js"
import { createClient, isSupabaseConfigured } from "./supabase"

type AuthContextType = {
  user: User | null
  loading: boolean
  isConfigured: boolean
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null; session: Session | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const isConfigured = isSupabaseConfigured()
  const supabase = createClient()

  useEffect(() => {
    // If Supabase is not configured, skip auth check
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }
    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: "Supabase not configured" } as AuthError, session: null }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error, session: data?.session ?? null }
  }, [supabase])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: "Supabase not configured" } as AuthError }
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }, [supabase])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [supabase])

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) {
      return { error: { message: "Supabase not configured" } as AuthError }
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    return { error }
  }, [supabase])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        signUp,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
