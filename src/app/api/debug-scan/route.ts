import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

export async function GET() {
  const envStatus = {
    SCAN_VERSION: process.env.SCAN_VERSION || "(not set, defaults to v3)",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `set (${process.env.OPENAI_API_KEY.slice(0, 8)}...)` : "MISSING",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.slice(0, 8)}...)` : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `set (${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 8)}...)` : "MISSING",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
  }

  const admin = createAdminClient()

  let scanHistoryRows: any[] = []
  let scanHistoryError: string | null = null
  try {
    const { data, error } = await admin
      .from("scan_history")
      .select("id, user_id, product_name, product_url, category, score, scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(10)
    if (error) scanHistoryError = JSON.stringify(error)
    else scanHistoryRows = data || []
  } catch (e) {
    scanHistoryError = String(e)
  }

  let scansRows: any[] = []
  let scansError: string | null = null
  try {
    const { data, error } = await admin
      .from("scans")
      .select("id, brand_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10)
    if (error) scansError = JSON.stringify(error)
    else scansRows = data || []
  } catch (e) {
    scansError = String(e)
  }

  let brandsRows: any[] = []
  try {
    const { data } = await admin
      .from("brands")
      .select("id, user_id, name, url, category, description")
      .limit(10)
    brandsRows = data || []
  } catch {}

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    envStatus,
    scanHistory: { count: scanHistoryRows.length, rows: scanHistoryRows, error: scanHistoryError },
    scans: { count: scansRows.length, rows: scansRows, error: scansError },
    brands: brandsRows,
  }, { status: 200 })
}
