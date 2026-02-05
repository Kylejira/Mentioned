import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getScanHistory, getScannedProducts } from "@/lib/scan/get-scan-history"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ history: [], products: [] })
    }
    
    const { searchParams } = new URL(request.url)
    const productUrl = searchParams.get('productUrl') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    
    // Fetch scan history
    const history = await getScanHistory(user.id, productUrl, limit)
    
    // Also fetch unique products for the product selector
    const products = await getScannedProducts(user.id)
    
    return NextResponse.json({ history, products })
  } catch (error) {
    console.error("Error fetching scan history:", error)
    return NextResponse.json({ history: [], products: [], error: "Failed to fetch history" })
  }
}
