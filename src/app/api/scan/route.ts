import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { runScanV2, convertToLegacyFormat } from "@/lib/scan-v2"
import { saveScanHistory } from "@/lib/scan/save-scan-history"
import { ScanOrchestrator, validateScanInput, type ScanResult as V3ScanResult, type ScanInput } from "@/lib/scan-v3"
import type { PlanTier } from "@/lib/scan-v3"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { scrapeUrl as jinaScapeUrl } from "@/lib/scan-v2/scraper"

export const maxDuration = 240 // 4 minutes max
export const dynamic = "force-dynamic"

const PRO_WHITELIST = (process.env.PRO_WHITELIST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
const SCAN_VERSION = process.env.SCAN_VERSION || "v3"

// ── v3 adapter functions ──────────────────────────────────────────────

function createLlmCallAdapter(): (prompt: string) => Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return async (prompt: string) => {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0,
    })
    return res.choices[0]?.message?.content || ""
  }
}

function createQueryLlmAdapter(): (query: string, provider: "openai" | "claude") => Promise<string> {
  let openai: OpenAI | null = null
  let anthropic: Anthropic | null = null

  return async (query: string, provider: "openai" | "claude") => {
    if (provider === "openai") {
      if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: query }],
        max_tokens: 1500,
        temperature: 0,
      })
      return res.choices[0]?.message?.content || ""
    } else {
      if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const res = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        temperature: 0,
        messages: [{ role: "user", content: query }],
      })
      const textBlock = res.content.find(b => b.type === "text")
      return textBlock?.type === "text" ? textBlock.text : ""
    }
  }
}

function createScrapeAdapter(): (url: string) => Promise<string> {
  return async (url: string) => {
    const result = await jinaScapeUrl(url)
    return result.content || ""
  }
}

// ── Shadow run: fire-and-forget v3 alongside v2 ──────────────────────

async function runV3Shadow(
  brandUrl: string,
  brandId: string | undefined,
  planTier: PlanTier,
  scanInput: ScanInput
): Promise<void> {
  try {
    console.log("[V3 Shadow] Starting shadow scan...")
    const adminDb = createAdminClient()

    const scanId = brandId || `shadow_${Date.now()}`
    const orchestrator = new ScanOrchestrator(
      adminDb,
      createLlmCallAdapter(),
      createQueryLlmAdapter(),
      createScrapeAdapter(),
      planTier
    )

    const v3Result = await orchestrator.runScan(scanId, brandUrl, scanInput)
    console.log("[V3 Shadow] Completed successfully")
    console.log(`[V3 Shadow] Score: ${v3Result.score.final_score}/100`)
    console.log(`[V3 Shadow] Queries: ${v3Result.query_count}`)
    console.log(`[V3 Shadow] Competitors found: ${v3Result.competitors.length}`)
    console.log(`[V3 Shadow] Profile: ${v3Result.profile.brand_name} (${v3Result.profile.category})`)
  } catch (err) {
    console.error("[V3 Shadow] Shadow scan failed (non-blocking):", err instanceof Error ? err.message : err)
  }
}

// ── Main handler ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
    
    if (!hasOpenAI) {
      console.error("OpenAI API key not configured")
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

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // ── Subscription / quota checks ──
    let planTier: PlanTier = "free"
    if (user) {
      const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")
      
      if (isWhitelisted) {
        planTier = "pro"
      } else {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single()

        const { data: brand } = await supabase
          .from("brands")
          .select("free_scan_used")
          .eq("user_id", user.id)
          .single()

        const freeScanUsed = brand?.free_scan_used || false

        if (!subscription) {
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
          planTier = "pro"
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
        } else if (subscription?.plan === "pro") {
          planTier = "pro"
        }
      }
    }

    const { 
      brandId, 
      brandName, 
      brandUrl, 
      description,
      category,
      categories,
      competitors,
      customQueries,
      isPaidPlan,
      // New v3 form fields
      coreProblem,
      targetBuyer,
      differentiators,
      buyerQuestions,
    } = body

    if (!brandName || !brandUrl) {
      return NextResponse.json(
        { error: "Missing required fields: brandName, brandUrl" },
        { status: 400 }
      )
    }
    
    const queryCount = isPaidPlan ? 12 : 8

    // Build ScanInput for v3 pipeline (gracefully handles missing fields for backwards compat)
    const scanInput: ScanInput = {
      brand_name: brandName,
      website_url: brandUrl,
      core_problem: coreProblem || description || "",
      target_buyer: targetBuyer || "",
      differentiators: differentiators || undefined,
      competitors: competitors || [],
      buyer_questions: buyerQuestions || customQueries || [],
      plan_tier: planTier,
    }

    // Validate new fields if v3 is active and they were provided
    if (SCAN_VERSION === "v3" && coreProblem) {
      const validationErrors = validateScanInput(scanInput)
      if (validationErrors.length > 0) {
        return NextResponse.json(
          { error: validationErrors[0].message, validationErrors },
          { status: 400 }
        )
      }
    }

    console.log(`\n[API] ========================================`)
    console.log(`[API] Starting scan (version: ${SCAN_VERSION})`)
    console.log(`[API] Brand Name: "${brandName}"`)
    console.log(`[API] URL: ${brandUrl}`)
    console.log(`[API] Plan tier: ${planTier}`)
    console.log(`[API] Category: ${category || "not provided"}`)
    console.log(`[API] Core problem: ${coreProblem ? coreProblem.slice(0, 60) + "..." : "not provided"}`)
    console.log(`[API] Target buyer: ${targetBuyer || "not provided"}`)
    console.log(`[API] Competitors: ${competitors?.join(", ") || "none"}`)
    console.log(`[API] Buyer questions: ${buyerQuestions?.length || 0}`)
    console.log(`[API] Query count: ${queryCount}`)
    console.log(`[API] ========================================\n`)

    // ── Shadow mode: fire v3 in background, don't await ──
    if (SCAN_VERSION === "shadow") {
      runV3Shadow(brandUrl, brandId, planTier, scanInput).catch(() => {})
    }

    // ── v3-only mode ──
    if (SCAN_VERSION === "v3") {
      return await handleV3Scan(supabase, user, brandId, brandName, brandUrl, category, categories, planTier, scanInput)
    }

    // ── Default: v2 pipeline (also runs in shadow mode) ──
    let scanResult
    try {
      scanResult = await runScanV2({
        productName: brandName,
        url: brandUrl,
        userCategory: category || (categories && categories[0]) || null,
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

    if (!scanResult.success) {
      console.error("[API] Scan failed:", scanResult.error)
      return NextResponse.json(
        { error: scanResult.error || "Scan failed" },
        { status: 500 }
      )
    }

    const result = convertToLegacyFormat(scanResult, brandName, category || categories?.[0])
    
    console.log(`[API] Scan complete`)
    console.log(`[API] Final brand name: "${result.brandName}"`)
    console.log(`[API] Final category: "${result.category}"`)
    console.log(`[API] Score: ${result.visibilityScore?.total || 0}/100`)

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
          product_data: result.productData,
          visibility_score: result.visibilityScore,
        })

        if (error) {
          console.error("[API] Failed to save scan:", error)
        } else {
          console.log("[API] Scan saved to database")
        }
      } catch (dbError) {
        console.error("[API] Database error:", dbError)
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")
        
        if (!isWhitelisted) {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .single()

          if (!subscription) {
            await supabase
              .from("brands")
              .update({ free_scan_used: true })
              .eq("user_id", user.id)
            console.log("[API] Marked free scan as used for user:", user.id)
          } else if (subscription.plan === "starter") {
            await supabase
              .from("subscriptions")
              .update({ 
                scans_used_this_period: (subscription.scans_used_this_period || 0) + 1 
              })
              .eq("id", subscription.id)
            console.log("[API] Incremented scan count for starter user:", user.id)
          }
        }
        
        const vs = result.visibilityScore as {
          total?: number;
          overall?: number;
          breakdown?: { mentionRate?: number; topThreeRate?: number; avgPosition?: number | null };
          byModel?: { chatgpt?: number; claude?: number };
        } | undefined
        
        const sources = result.sources as { chatgpt?: { mentioned?: boolean }; claude?: { mentioned?: boolean } } | undefined
        
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
    }

    console.log(`[API v2] ✅ Returning result: brandName="${result.brandName}", category="${result.category}", score=${result.visibilityScore?.total || 0}`)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[API] ❌ Scan error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: `Scan failed: ${errorMessage}. Please try again.` },
      { status: 500 }
    )
  }
}

// ── v3-only handler ──────────────────────────────────────────────────

async function handleV3Scan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string } | null,
  brandId: string | undefined,
  brandName: string,
  brandUrl: string,
  category: string | undefined,
  categories: string[] | undefined,
  planTier: PlanTier,
  scanInput: ScanInput
) {
  try {
    const adminDb = createAdminClient()
    const scanId = brandId || `v3_${Date.now()}`
    const orchestrator = new ScanOrchestrator(
      adminDb,
      createLlmCallAdapter(),
      createQueryLlmAdapter(),
      createScrapeAdapter(),
      planTier
    )

    const v3Result = await orchestrator.runScan(scanId, brandUrl, scanInput)

    console.log(`[API v3] Scan complete — score: ${v3Result.score.final_score}/100`)

    // Convert v3 result to the legacy format the frontend expects
    const legacyResult = convertV3ToLegacy(v3Result, brandName, category || categories?.[0])

    // Update subscription usage
    if (user) {
      const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")
      if (!isWhitelisted) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single()

        if (!subscription) {
          await supabase
            .from("brands")
            .update({ free_scan_used: true })
            .eq("user_id", user.id)
        } else if (subscription.plan === "starter") {
          await supabase
            .from("subscriptions")
            .update({
              scans_used_this_period: (subscription.scans_used_this_period || 0) + 1,
            })
            .eq("id", subscription.id)
        }
      }

      // Save to scan history
      try {
        const { saveScanHistory } = await import("@/lib/scan/save-scan-history")
        await saveScanHistory(user.id, {
          productUrl: brandUrl,
          productName: brandName,
          category: category || categories?.[0] || v3Result.profile.category,
          score: v3Result.score.final_score,
          mentionRate: v3Result.score.mention_rate * 100,
          top3Rate: 0,
          avgPosition: null,
          chatgptScore: null,
          claudeScore: null,
          chatgptMentioned: null,
          claudeMentioned: null,
          fullResult: {
            ...legacyResult,
            brandName,
            brandUrl,
            timestamp: new Date().toISOString(),
          },
        })
        console.log(`[API v3] ✅ scan_history saved for user ${user.id}, brand="${brandName}"`)
      } catch (historyErr) {
        console.error("[API v3] ❌ Error saving scan history:", historyErr)
      }
    }

    console.log(`[API v3] ✅ Returning result: brandName="${legacyResult.brandName}", category="${legacyResult.category}", score=${legacyResult.visibilityScore?.total}`)
    return NextResponse.json(legacyResult)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 3).join(" | ") : ""
    console.error(`[API v3] ❌ Scan failed: ${msg}`)
    console.error(`[API v3] ❌ Stack: ${stack}`)
    return NextResponse.json(
      { error: `Scan failed: ${msg}`, phase: msg.match(/Phase \d+ \([^)]+\)/)?.[0] || "unknown" },
      { status: 500 }
    )
  }
}

/**
 * Map v3 ScanResult → legacy frontend format so the dashboard renders correctly.
 * This is a thin shim; once the frontend is updated for v3 this can be removed.
 */
function convertV3ToLegacy(v3: V3ScanResult, brandName: string, category?: string) {
  const mentionRate = Math.round(v3.score.mention_rate * 100)
  const score = v3.score.final_score

  return {
    status: "complete",
    brandName,
    category: category || v3.profile.category,
    visibilityScore: {
      total: score,
      overall: score,
      breakdown: {
        mentionRate,
        topThreeRate: 0,
        avgPosition: null,
      },
      byModel: {
        chatgpt: null,
        claude: null,
      },
    },
    productData: {
      name: v3.profile.brand_name,
      category: v3.profile.category,
      competitors: v3.profile.competitors_mentioned,
      description: v3.profile.tagline,
    },
    sources: {},
    queries_tested: [],
    query_count: v3.query_count,
    signals: [],
    actions: [],
    competitor_results: v3.competitors.map((c) => ({
      name: c.competitor_name,
      mentionRate: c.last_mention_count,
    })),
    raw_responses: [],
    scan_version: "v3",
  }
}
