import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

export async function GET() {
  const envStatus = {
    SCAN_VERSION: process.env.SCAN_VERSION || "(not set, defaults to v3)",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `set (${process.env.OPENAI_API_KEY.slice(0, 8)}...)` : "MISSING",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.slice(0, 8)}...)` : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `set (${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 8)}...)` : "MISSING",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let scanHistoryRows: any[] = []
  let scanHistoryError: string | null = null

  try {
    const { data, error } = await supabase
      .from("scan_history")
      .select("id, product_name, product_url, category, score, scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(5)

    if (error) {
      scanHistoryError = JSON.stringify(error)
    } else {
      scanHistoryRows = data || []
    }
  } catch (e) {
    scanHistoryError = String(e)
  }

  let scansRows: any[] = []
  let scansError: string | null = null

  try {
    const { data, error } = await supabase
      .from("scans")
      .select("id, brand_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    if (error) {
      scansError = JSON.stringify(error)
    } else {
      scansRows = data || []
    }
  } catch (e) {
    scansError = String(e)
  }

  let brandsRows: any[] = []
  try {
    if (user) {
      const { data } = await supabase
        .from("brands")
        .select("id, name, url, category, description")
        .eq("user_id", user.id)
        .limit(3)
      brandsRows = data || []
    }
  } catch {}

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    user: user ? { id: user.id, email: user.email } : null,
    envStatus,
    scanHistory: { rows: scanHistoryRows, error: scanHistoryError },
    scans: { rows: scansRows, error: scansError },
    brands: brandsRows,
  }, { status: 200 })
}
