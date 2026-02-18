import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { runScanV2, convertToLegacyFormat } from "@/lib/scan-v2"
import { saveScanHistory } from "@/lib/scan/save-scan-history"

export const maxDuration = 240 // 4 minutes max
export const dynamic = "force-dynamic"

const PRO_WHITELIST = (process.env.PRO_WHITELIST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)

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

    // Check subscription status
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Check whitelist first
      const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")
      
      if (!isWhitelisted) {
        // Get subscription
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single()

        // Get brand for free_scan_used
        const { data: brand } = await supabase
          .from("brands")
          .select("free_scan_used")
          .eq("user_id", user.id)
          .single()

        const freeScanUsed = brand?.free_scan_used || false

        // Check if user can scan
        if (!subscription) {
          // Free tier - check if free scan used
          if (freeScanUsed) {
            return NextResponse.json(
              { 
                error: "upgrade_required",
                message: "You've used your free scan. Upgrade to run more scans.",
                upgradeRequired: true
              },
              { status: 403 }
            )
          }
        } else if (subscription.plan === "starter") {
          // Starter tier - check scan limit
          const scansUsed = subscription.scans_used_this_period || 0
          const scansLimit = subscription.scans_limit || 10
          
          if (scansUsed >= scansLimit) {
            return NextResponse.json(
              {
                error: "scan_limit_reached",
                message: `You've used all ${scansLimit} scans this month. Upgrade to Pro for unlimited scans.`,
                scansUsed,
                scansLimit,
                resetDate: subscription.current_period_end,
                upgradeRequired: true
              },
              { status: 403 }
            )
          }
        }
        // Pro users have unlimited scans - no check needed
      }
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

    // Save to scan history and update subscription usage for logged-in users
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")
        
        // Update subscription usage (if not whitelisted)
        if (!isWhitelisted) {
          // Get subscription
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .single()

          if (!subscription) {
            // Free tier - mark free scan as used
            await supabase
              .from("brands")
              .update({ free_scan_used: true })
              .eq("user_id", user.id)
            console.log("[API] Marked free scan as used for user:", user.id)
          } else if (subscription.plan === "starter") {
            // Starter tier - increment scan count
            await supabase
              .from("subscriptions")
              .update({ 
                scans_used_this_period: (subscription.scans_used_this_period || 0) + 1 
              })
              .eq("id", subscription.id)
            console.log("[API] Incremented scan count for starter user:", user.id)
          }
          // Pro tier - no tracking needed (unlimited)
        }
        
        // Extract visibility score with type safety
        const vs = result.visibilityScore as {
          total?: number;
          overall?: number;
          breakdown?: { mentionRate?: number; topThreeRate?: number; avgPosition?: number | null };
          byModel?: { chatgpt?: number; claude?: number };
        } | undefined
        
        // Sources can be an object with chatgpt/claude keys or an array
        const sources = result.sources as { chatgpt?: { mentioned?: boolean }; claude?: { mentioned?: boolean } } | undefined
        
        // Build the full result to save (same format the dashboard expects)
        const fullResultForDb = {
          ...result,
          brandName,
          brandUrl,
          timestamp: new Date().toISOString(),
        }
        
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
          fullResult: fullResultForDb,
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
