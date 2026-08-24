import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { validateScanInput, type ScanInput } from "@/lib/scan-v3"
import type { PlanTier } from "@/lib/scan-v3"
import { runScan } from "@/lib/scan-runner"
import { generateStrategicPlan } from "@/lib/strategic/generate-plan"
import { computeProviderComparison } from "@/lib/scan-v3/scoring/provider-comparison"
import { computeScoreDeltas } from "@/lib/scan-v3/scoring/compute-deltas"
import { computeShareOfVoice } from "@/lib/scan-v3/scoring/share-of-voice"
import { computeOpportunityMetrics } from "@/lib/scan-v3/scoring/opportunity-analyzer"
import { analyzeCompetitorReasons } from "@/lib/scan-v3/analysis/competitor-reason-analyzer"
import { identifyContentOpportunities } from "@/lib/scan-v3/analysis/content-opportunity-analyzer"
import { persistScanResults } from "@/lib/scan-v3/persistence/persist-scan-results"
import { OpenAIProvider } from "@/lib/providers"
import { canUseStrategicBrain } from "@/lib/plans/enforce"
import { log } from "@/lib/logger"
import { getClientIp } from "@/lib/rate-limit/get-client-ip"
import {
  checkPublicScanRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit/public-scan-limit"

export const maxDuration = 240
export const dynamic = "force-dynamic"

const logger = log.create("scan-api")
const PRO_WHITELIST = (process.env.PRO_WHITELIST_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)

function isQueueEnabled(): boolean {
  return !!process.env.REDIS_URL
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      logger.error("OpenAI API key not configured")
      return NextResponse.json(
        { error: "OpenAI API key required. Please add OPENAI_API_KEY in environment variables." },
        { status: 500 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Public scans (from /scan) always run on free-tier limits regardless of who
    // is calling, and never consume the caller's tracked free-scan quota.
    // Detect early so we can skip subscription/quota gates entirely.
    const isPublicScan = body?.source === "public"

    // ── Per-IP rate limit (anonymous public scans only) ──
    // Signed-up users are unlimited per the access model — they never hit this gate.
    // Must run BEFORE any DB write or queue enqueue so abusive bursts cost us nothing.
    let publicRateLimit: Awaited<ReturnType<typeof checkPublicScanRateLimit>> | null = null
    if (isPublicScan && !user) {
      const ip = getClientIp(request)
      if (ip) {
        publicRateLimit = await checkPublicScanRateLimit(ip)
        if (!publicRateLimit.allowed) {
          // Build a prefilled signup URL so the form can guide the user straight in.
          const brandHint = typeof body?.brandUrl === "string" ? body.brandUrl : ""
          const signupUrl = `/signup?source=rate_limit${
            brandHint ? `&brand=${encodeURIComponent(brandHint)}` : ""
          }`
          logger.info("Public scan rate limit hit", {
            limit: publicRateLimit.limit,
            resetAt: publicRateLimit.resetAt,
          })
          return NextResponse.json(
            {
              error: "rate_limited",
              message:
                "You've used your 3 free scans today. Sign up free for unlimited scans and weekly tracking.",
              limit: publicRateLimit.limit,
              remaining: publicRateLimit.remaining,
              resetAt: new Date(publicRateLimit.resetAt).toISOString(),
              retryAfterSeconds: publicRateLimit.retryAfterSeconds,
              signupUrl,
            },
            { status: 429, headers: rateLimitHeaders(publicRateLimit) },
          )
        }
      } else {
        // No IP detectable (test env / odd network) — log and allow through.
        // Turnstile + global daily cap are still in place as second/third lines.
        logger.warn("Public scan with no resolvable IP — allowing", {
          ua: request.headers.get("user-agent") ?? null,
        })
      }
    }

    // ── Subscription / quota checks (skipped for public scans) ──
    let planTier: PlanTier = "free"
    let effectivePlan = "free"
    if (user && !isPublicScan) {
      const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")

      if (isWhitelisted) {
        planTier = "pro"
        effectivePlan = "pro_monthly"
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
                upgradeRequired: true,
              },
              { status: 403 }
            )
          }
        } else if (subscription.plan === "starter") {
          planTier = "pro"
          effectivePlan = "starter"
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
                upgradeRequired: true,
              },
              { status: 403 }
            )
          }
        } else if (subscription?.plan === "pro") {
          planTier = "pro"
          effectivePlan = subscription.plan
        } else if (subscription?.plan) {
          effectivePlan = subscription.plan
        }
      }
    }

    const {
      brandId,
      brandName,
      brandUrl,
      category,
      categories,
      competitors,
      customQueries,
      coreProblem,
      targetBuyer,
      differentiators,
      buyerQuestions,
      description,
      source,
      leadEmail,
    } = body

    if (!brandName || !brandUrl) {
      return NextResponse.json({ error: "Missing required fields: brandName, brandUrl" }, { status: 400 })
    }
    // (isPublicScan, planTier, effectivePlan were resolved above before quota gates.)
    // `source` is intentionally not destructured into a local — we use isPublicScan instead.
    void source

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

    if (coreProblem) {
      const validationErrors = validateScanInput(scanInput)
      if (validationErrors.length > 0) {
        return NextResponse.json(
          { error: validationErrors[0].message, validationErrors },
          { status: 400 }
        )
      }
    }

    // Every scan gets a fresh uuid. brand_id is stored separately for history/deltas.
    const scanId = crypto.randomUUID()
    const resolvedCategory = category || categories?.[0]

    // ── Async mode: enqueue and return immediately ──
    if (isQueueEnabled()) {
      logger.info("Enqueueing scan (async)", { scanId, brand: brandName, url: brandUrl, plan: planTier, isPublic: isPublicScan })

      const adminDb = createAdminClient()

      // Create scan record with "queued" status (one row per scan)
      await adminDb.from("scans").insert({
        id: scanId,
        brand_id: isPublicScan ? null : (brandId || null),
        status: "queued",
        scan_version: "v3",
        core_problem: coreProblem || null,
        target_buyer: targetBuyer || null,
        differentiators: differentiators || null,
        buyer_questions: buyerQuestions || customQueries || [],
        is_public: isPublicScan,
        lead_email: isPublicScan && leadEmail ? String(leadEmail).slice(0, 320) : null,
      })

      const { getScanQueue } = await import("@/lib/queue")

      await getScanQueue().add("scan", {
        scanId,
        // Public scans NEVER attribute to a user's history — even if a logged-in
        // user somehow lands on the public flow.
        userId: isPublicScan ? null : (user?.id || null),
        brandName,
        brandUrl,
        brandId: isPublicScan ? undefined : brandId,
        category: resolvedCategory,
        coreProblem: coreProblem || description || "",
        targetBuyer: targetBuyer || "",
        differentiators: differentiators || undefined,
        competitors: competitors || [],
        buyerQuestions: buyerQuestions || customQueries || [],
        planTier,
        effectivePlan,
        userEmail: isPublicScan ? undefined : (user?.email || undefined),
      }, { jobId: scanId })

      return NextResponse.json(
        { scanId, status: "queued" },
        publicRateLimit
          ? { headers: rateLimitHeaders(publicRateLimit) }
          : undefined,
      )
    }

    // ── Sync fallback: run inline when Redis is not available ──
    logger.info("Starting scan (sync)", { brand: brandName, url: brandUrl, plan: planTier })

    const adminDb = createAdminClient()

    await adminDb.from("scans").insert({
      id: scanId,
      brand_id: isPublicScan ? null : (brandId || null),
      status: "processing",
      scan_version: "v3",
      core_problem: coreProblem || null,
      target_buyer: targetBuyer || null,
      differentiators: differentiators || null,
      buyer_questions: buyerQuestions || customQueries || [],
      is_public: isPublicScan,
      lead_email: isPublicScan && leadEmail ? String(leadEmail).slice(0, 320) : null,
    })

    try {
      const result = await runScan({
        scanId,
        // Public scans NEVER attribute to a user's history.
        userId: isPublicScan ? null : (user?.id || null),
        brandName,
        brandUrl,
        category: resolvedCategory,
        planTier,
        input: scanInput,
        effectivePlan,
      })

      // Only consume tracked-quota for non-public scans.
      if (user && !isPublicScan) {
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
      }

      // Provider comparison + deltas + share of voice (non-blocking)
      let scanDeltas: Record<string, unknown> | null = null
      let scanShareOfVoice: Record<string, unknown> | null = null
      let scanOpportunity: unknown = null
      let scanContentOpportunities: unknown = null
      try {
        // Persist per-(query, provider) rows BEFORE anything that reads from
        // scan_results (share-of-voice, opportunity-analyzer,
        // competitor-reason-analyzer). Non-fatal.
        try {
          const persistRes = await persistScanResults(scanId, result.v3Result.analyses, adminDb)
          if (persistRes.error) {
            logger.warn("persistScanResults non-fatal", {
              scanId,
              inserted: persistRes.inserted,
              skipped: persistRes.skipped,
              error: persistRes.error,
            })
          } else {
            logger.info("persistScanResults ok", {
              scanId,
              inserted: persistRes.inserted,
              skipped: persistRes.skipped,
            })
          }
        } catch (persistErr) {
          logger.error("persistScanResults threw (non-fatal)", {
            scanId,
            error: persistErr instanceof Error ? persistErr.message : String(persistErr),
          })
        }

        const comparison = await computeProviderComparison(scanId, adminDb)
        const { data: existing } = await adminDb
          .from("scans")
          .select("summary")
          .eq("id", scanId)
          .single()

        let deltas = null
        try {
          const providerScores: Record<string, number> = {}
          if (comparison?.providers) {
            for (const p of comparison.providers) {
              providerScores[p.provider] = p.composite_score
            }
          }

          if (brandId) {
            deltas = await computeScoreDeltas(scanId, brandId, {
              overall: result.score,
              mention_rate: comparison?.providers?.length
                ? comparison.providers.reduce((s, p) => s + p.mention_rate, 0) / comparison.providers.length
                : 0,
              consistency: comparison?.cross_provider?.consistency_score ?? 0,
              providerScores,
            }, adminDb)
          }
          scanDeltas = deltas as unknown as Record<string, unknown>
        } catch (deltaErr) {
          logger.warn("Delta computation failed (non-fatal)", {
            scanId,
            error: deltaErr instanceof Error ? deltaErr.message : String(deltaErr),
          })
        }

        let shareOfVoice = null
        try {
          shareOfVoice = await computeShareOfVoice(scanId, brandName, adminDb)
          scanShareOfVoice = shareOfVoice as unknown as Record<string, unknown>
        } catch (sovErr) {
          logger.warn("Share of voice computation failed (non-fatal)", {
            scanId,
            error: sovErr instanceof Error ? sovErr.message : String(sovErr),
          })
        }

        let opportunity = null
        try {
          opportunity = await computeOpportunityMetrics(scanId, adminDb)
          scanOpportunity = opportunity
        } catch (oppErr) {
          logger.warn("Opportunity metrics computation failed (non-fatal)", {
            scanId,
            error: oppErr instanceof Error ? oppErr.message : String(oppErr),
          })
        }

        let competitorReasons = null
        try {
          const reasonLlm = new OpenAIProvider({ model: "gpt-4o-mini", maxTokens: 2000, temperature: 0 })
          competitorReasons = await analyzeCompetitorReasons(
            scanId,
            adminDb,
            (prompt: string) => reasonLlm.generateResponse(prompt)
          )
        } catch (crErr) {
          logger.warn("Competitor reason analysis failed (non-fatal)", {
            scanId,
            error: crErr instanceof Error ? crErr.message : String(crErr),
          })
        }

        let contentOpportunities = null
        try {
          contentOpportunities = identifyContentOpportunities(
            result.v3Result.analyses,
            competitorReasons
          )
          scanContentOpportunities = contentOpportunities
        } catch (coErr) {
          logger.warn("Content opportunity identification failed (non-fatal)", {
            scanId,
            error: coErr instanceof Error ? coErr.message : String(coErr),
          })
        }

        const finalStatus = result.score >= 50 ? "recommended" : result.score > 0 ? "low_visibility" : "not_mentioned"

        await adminDb
          .from("scans")
          .update({
            status: finalStatus,
            summary: {
              ...(existing?.summary as Record<string, unknown> ?? {}),
              provider_comparison: comparison,
              legacy_result: result.legacyResult,
              ...(deltas ? { deltas } : {}),
              ...(shareOfVoice ? { share_of_voice: shareOfVoice } : {}),
              ...(opportunity ? { opportunity } : {}),
              ...(competitorReasons ? { competitor_reasons: competitorReasons } : {}),
              ...(contentOpportunities ? { content_opportunities: contentOpportunities } : {}),
            },
          })
          .eq("id", scanId)
      } catch (compErr) {
        logger.warn("Provider comparison failed (non-fatal)", {
          scanId,
          error: compErr instanceof Error ? compErr.message : String(compErr),
        })
      }

      // ENFORCEMENT 3: Strategic brain gated by plan
      if (canUseStrategicBrain(effectivePlan)) {
        try {
          await generateStrategicPlan(scanId)
        } catch (strategyErr) {
          logger.warn("Strategic plan generation failed (non-fatal)", {
            scanId,
            error: strategyErr instanceof Error ? strategyErr.message : String(strategyErr),
          })
        }
      } else {
        logger.info("Strategic plan skipped (plan does not include strategic brain)", { scanId, effectivePlan })
      }

      return NextResponse.json(
        {
          ...result.legacyResult,
          _scanId: scanId,
          ...(scanDeltas ? { _deltas: scanDeltas } : {}),
          ...(scanShareOfVoice ? { _share_of_voice: scanShareOfVoice } : {}),
          ...(scanOpportunity ? { _opportunity: scanOpportunity } : {}),
          ...(scanContentOpportunities ? { _content_opportunities: scanContentOpportunities } : {}),
        },
        publicRateLimit
          ? { headers: rateLimitHeaders(publicRateLimit) }
          : undefined,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 3).join(" | ") : ""
      logger.error("Scan failed", { error: msg, stack })
      return NextResponse.json(
        { error: `Scan failed: ${msg}`, phase: msg.match(/Phase \d+ \([^)]+\)/)?.[0] || "unknown" },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    logger.error("Unexpected scan error", { error: errorMessage })
    return NextResponse.json(
      { error: `Scan failed: ${errorMessage}. Please try again.` },
      { status: 500 }
    )
  }
}
