import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Return a dummy client for development without Supabase
    return {
      from: () => ({
        insert: () => ({ error: null }),
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                single: () => ({ data: null, error: null }),
              }),
            }),
            single: () => ({ data: null, error: null }),
          }),
          single: () => ({ data: null, error: null }),
        }),
      }),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as ReturnType<typeof createServerClient>
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore - can't set cookies in Server Components
          }
        },
      },
    }
  )
}
