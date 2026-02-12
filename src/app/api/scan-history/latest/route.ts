import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/**
 * GET /api/scan-history/latest
 * Returns the most recent full scan result for the logged-in user.
 * Used by the dashboard to load per-user scan data instead of shared localStorage.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ scan: null, error: "Not authenticated" }, { status: 401 })
    }

    // Fetch the most recent scan with a full_result
    const { data, error } = await supabase
      .from("scan_history")
      .select("id, product_name, product_url, category, score, full_result, scanned_at")
      .eq("user_id", user.id)
      .not("full_result", "is", null)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, which is fine
      console.error("[LatestScan] Error fetching:", error)
    }

    if (!data || !data.full_result) {
      return NextResponse.json({ scan: null })
    }

    return NextResponse.json({
      scan: {
        id: data.id,
        productName: data.product_name,
        productUrl: data.product_url,
        category: data.category,
        score: data.score,
        scannedAt: data.scanned_at,
        fullResult: data.full_result,
      },
    })
  } catch (err) {
    console.error("[LatestScan] Exception:", err)
    return NextResponse.json({ scan: null, error: "Failed to fetch" }, { status: 500 })
  }
}
