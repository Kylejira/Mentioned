import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { runScanV2, convertToLegacyFormat } from "@/lib/scan-v2"
import { saveScanHistory } from "@/lib/scan/save-scan-history"

export const maxDuration = 300 // Allow up to 5 minutes for the scan (Vercel Pro limit)
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // Check if API keys are configured
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
    
    if (!hasOpenAI) {
      console.error("OpenAI API key not configured (required for scan v2)")
      return NextResponse.json(
        { error: "OpenAI API key required. Please add OPENAI_API_KEY in environment variables." },
        { status: 500 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    // Validate required fields - extract ALL user-provided data
    const { 
      brandId, 
      brandName, 
      brandUrl, 
      description,
      category,      // User-selected category
      categories,    // User-provided categories array
      competitors,   // User-provided competitors
      customQueries, // User-provided custom queries
      isPaidPlan 
    } = body

    if (!brandName || !brandUrl) {
      return NextResponse.json(
        { error: "Missing required fields: brandName, brandUrl" },
        { status: 400 }
      )
    }
    
    // Query count based on plan
    const queryCount = isPaidPlan ? 12 : 8 // Paid plans get more queries
    
    // Log ALL input data for debugging
    console.log(`\n[API] ========================================`)
    console.log(`[API] Starting scan v2`)
    console.log(`[API] Brand Name: "${brandName}"`)
    console.log(`[API] URL: ${brandUrl}`)
    console.log(`[API] Category: ${category || 'not provided'}`)
    console.log(`[API] Categories: ${categories?.join(', ') || 'none'}`)
    console.log(`[API] Competitors: ${competitors?.join(', ') || 'none'}`)
    console.log(`[API] Query count: ${queryCount}`)
    console.log(`[API] ========================================\n`)

    // Run the new v2 scan with ALL user-provided data
    let scanResult
    try {
      scanResult = await runScanV2({
        productName: brandName,  // User's exact brand name
        url: brandUrl,
        userCategory: category || (categories && categories[0]) || null,  // User-provided category
        userCategories: categories || [],
        userCompetitors: competitors || [],
        customQueries: customQueries || [],
        queryCount,
        onProgress: (step, status, message) => {
          console.log(`[API Progress] ${step}: ${status} - ${message || ''}`)
        }
      })
    } catch (scanError) {
      console.error("[API] Scan execution error:", scanError)
      const errorMessage = scanError instanceof Error ? scanError.message : "Unknown error"
      return NextResponse.json(
        { error: `Scan failed: ${errorMessage}` },
        { status: 500 }
      )
    }

    // Check if scan was successful
    if (!scanResult.success) {
      console.error("[API] Scan failed:", scanResult.error)
      return NextResponse.json(
        { error: scanResult.error || "Scan failed" },
        { status: 500 }
      )
    }

    // Convert to legacy format, passing the USER'S brand name (not AI-extracted)
    const result = convertToLegacyFormat(scanResult, brandName, category || categories?.[0])
    
    console.log(`[API] Scan complete`)
    console.log(`[API] Final brand name: "${result.brandName}"`)
    console.log(`[API] Final category: "${result.category}"`)
    console.log(`[API] Score: ${result.visibilityScore?.total || 0}/100`)

    // If brandId is provided, save to database
    if (brandId) {
      try {
        const supabase = await createClient()
        
        const { error } = await supabase.from("scans").insert({
          brand_id: brandId,
          status: result.status,
          sources: result.sources,
          queries_tested: result.queries_tested,
          signals: result.signals,
          actions: result.actions,
          competitor_results: result.competitor_results,
          raw_responses: result.raw_responses,
          // New v2 fields
          product_data: result.productData,
          visibility_score: result.visibilityScore,
        })

        if (error) {
          console.error("[API] Failed to save scan:", error)
          // Continue anyway - return the results even if save fails
        } else {
          console.log("[API] Scan saved to database")
        }
      } catch (dbError) {
        console.error("[API] Database error:", dbError)
        // Continue anyway
      }
    }

    // Save to scan history for logged-in users (for progress tracking)
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Extract visibility score with type safety
        const vs = result.visibilityScore as {
          total?: number;
          overall?: number;
          breakdown?: { mentionRate?: number; topThreeRate?: number; avgPosition?: number | null };
          byModel?: { chatgpt?: number; claude?: number };
        } | undefined
        
        // Sources can be an object with chatgpt/claude keys or an array
        const sources = result.sources as { chatgpt?: { mentioned?: boolean }; claude?: { mentioned?: boolean } } | undefined
        
        await saveScanHistory(user.id, {
          productUrl: brandUrl,
          productName: brandName,
          category: result.category,
          score: vs?.total || vs?.overall || 0,
          mentionRate: vs?.breakdown?.mentionRate || 0,
          top3Rate: vs?.breakdown?.topThreeRate || 0,
          avgPosition: vs?.breakdown?.avgPosition || null,
          chatgptScore: vs?.byModel?.chatgpt || null,
          claudeScore: vs?.byModel?.claude || null,
          chatgptMentioned: sources?.chatgpt?.mentioned ?? null,
          claudeMentioned: sources?.claude?.mentioned ?? null,
        })
        console.log("[API] Scan history saved for user:", user.id)
      }
    } catch (historyError) {
      console.error("[API] Error saving scan history:", historyError)
      // Continue anyway - don't fail the scan for history issues
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[API] Scan error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: `Scan failed: ${errorMessage}. Please try again.` },
      { status: 500 }
    )
  }
}
