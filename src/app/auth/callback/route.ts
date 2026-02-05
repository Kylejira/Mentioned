import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const type = searchParams.get("type")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = createClient()
    
    // If Supabase isn't configured, redirect to dashboard
    if (!supabase) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // If it's a password recovery, redirect to reset password page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
