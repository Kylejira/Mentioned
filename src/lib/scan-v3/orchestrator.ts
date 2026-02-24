import type { SupabaseClient } from "@supabase/supabase-js"
import { SaaSProfiler } from "./profiler/saas-profiler"
import { QueryGenerator } from "./queries/query-generator"
import { QueryValidator } from "./queries/query-validator"
import { QueryRepository } from "./queries/query-repository"
import { DetectionEngine } from "./detection/detection-engine"
import { buildAliasRegistry, enrichAliasesWithLlm } from "./detection/alias-builder"
import { ScoringEngine } from "./scoring/scoring-engine"
import { CompetitorTracker } from "./competitors/competitor-tracker"
import { resolveLimits, type PlanTier, type ScanLimits } from "./config/scan-limits"
import type { ScanInput } from "./types/scan-input"
import type { SaaSProfile } from "./profiler/types"
import type { ValidatedQuery } from "./queries/types"
import type { ResponseAnalysis } from "./detection/types"
import type { ScoringBreakdown } from "./scoring/types"
import type { CompetitorRecord } from "./competitors/types"

export interface ScanResult {
  scan_id: string
  profile: SaaSProfile
  query_count: number
  score: ScoringBreakdown
  competitors: CompetitorRecord[]
}

export class ScanOrchestrator {
  private limits: ScanLimits
  private profiler: SaaSProfiler
  private generator: QueryGenerator
  private queryRepo: QueryRepository
  private scoring: ScoringEngine
  private competitorTracker: CompetitorTracker

  constructor(
    private supabase: SupabaseClient,
    private llmCall: (prompt: string) => Promise<string>,
    private queryLlm: (query: string, provider: "openai" | "claude") => Promise<string>,
    private scrapeUrl: (url: string) => Promise<string>,
    plan: PlanTier = "free"
  ) {
    this.limits = resolveLimits(plan)
    this.profiler = new SaaSProfiler(llmCall, scrapeUrl)
    this.generator = new QueryGenerator(llmCall, this.limits)
    this.queryRepo = new QueryRepository(supabase)
    this.scoring = new ScoringEngine()
    this.competitorTracker = new CompetitorTracker(supabase)
  }

  async runScan(scanId: string, url: string, input?: ScanInput): Promise<ScanResult> {
    console.log(`[Orchestrator] Starting scan ${scanId} for ${url}`)

    console.log(`══ STAGE 1: SCAN INPUT ══`)
    console.log(`Brand: ${input?.brand_name || "N/A"}`)
    console.log(`URL: ${url}`)
    console.log(`Competitors: ${JSON.stringify(input?.competitors || [])}`)
    console.log(`Core problem: ${input?.core_problem || "N/A"}`)
    console.log(`Target buyer: ${input?.target_buyer || "N/A"}`)

    let profile: SaaSProfile
    try {
      profile = await this.profiler.profile(url, input)
      console.log(`══ STAGE 2: PROFILE ══`)
      console.log(`Profile brand: ${profile.brand_name}`)
      console.log(`Profile aliases: ${JSON.stringify(profile.brand_aliases)}`)
      console.log(`Profile category: ${profile.category}`)
      console.log(`Profile competitors: ${JSON.stringify(profile.competitors_mentioned)}`)
      console.log(`Profile core_problem: ${profile.core_problem || "N/A"}`)
      console.log(`Profile target_buyer: ${profile.target_buyer || "N/A"}`)
    } catch (err) {
      throw new Error(`Phase 1 (Profile) failed: ${err instanceof Error ? err.message : err}`)
    }

    let cappedQueries: ValidatedQuery[]
    try {
      const rawQueries = await this.generator.generate(profile)
      console.log(`══ STAGE 3: QUERIES ══`)
      console.log(`Raw queries generated: ${rawQueries.length}`)
      const validator = new QueryValidator(this.llmCall)
      const validatedQueries = await validator.validate(rawQueries, profile)
      console.log(`Validated queries: ${validatedQueries.length}`)
      cappedQueries = validatedQueries.slice(0, this.limits.maxQueries)
      console.log(`Capped queries (max ${this.limits.maxQueries}): ${cappedQueries.length}`)
      console.log(`Sample queries (first 5): ${JSON.stringify(cappedQueries.slice(0, 5).map(q => q.text))}`)
      const intentDist: Record<string, number> = {}
      for (const q of cappedQueries) { intentDist[q.intent] = (intentDist[q.intent] || 0) + 1 }
      console.log(`Intent distribution: ${JSON.stringify(intentDist)}`)
    } catch (err) {
      throw new Error(`Phase 2 (Query Gen) failed: ${err instanceof Error ? err.message : err}`)
    }

    try {
      await this.queryRepo.store(scanId, cappedQueries)
      console.log(`[Orchestrator] Phase 2c ✅ Stored ${cappedQueries.length} queries`)
    } catch (err) {
      console.error(`[Orchestrator] Phase 2c ⚠️ Query store failed (non-fatal): ${err instanceof Error ? err.message : err}`)
    }

    let detection: DetectionEngine
    try {
      let aliasRegistry = buildAliasRegistry(profile)
      if (this.limits.enableSemanticConfirm && profile.competitors_mentioned.length > 0) {
        aliasRegistry = await enrichAliasesWithLlm(
          profile.competitors_mentioned,
          this.llmCall,
          aliasRegistry
        )
      }
      detection = new DetectionEngine(
        profile.brand_name,
        profile.brand_aliases,
        this.limits.enableSemanticConfirm ? this.llmCall : undefined,
        aliasRegistry
      )
      console.log(`[Orchestrator] Phase 3 ✅ Alias registry built`)
    } catch (err) {
      throw new Error(`Phase 3 (Alias) failed: ${err instanceof Error ? err.message : err}`)
    }

    let analyses: ResponseAnalysis[]
    try {
      analyses = await this.executeQueries(cappedQueries, detection, profile)
      console.log(`══ STAGE 5: DETECTION RESULTS ══`)
      console.log(`Total analyses: ${analyses.length}`)
      const mentionsFound = analyses.filter(a => a.brand_detection.detected).length
      console.log(`Mentions found: ${mentionsFound} / ${analyses.length}`)
      const methodsUsed = [...new Set(analyses.map(a => a.brand_detection.method))]
      console.log(`Detection methods used: ${JSON.stringify(methodsUsed)}`)
      const byProvider: Record<string, { total: number; detected: number }> = {}
      for (const a of analyses) {
        if (!byProvider[a.provider]) byProvider[a.provider] = { total: 0, detected: 0 }
        byProvider[a.provider].total++
        if (a.brand_detection.detected) byProvider[a.provider].detected++
      }
      console.log(`By provider: ${JSON.stringify(byProvider)}`)
      const emptyResponses = analyses.filter(a => !a.raw_response || a.raw_response.trim().length === 0).length
      console.log(`Empty responses: ${emptyResponses}`)
    } catch (err) {
      throw new Error(`Phase 4 (Execute) failed: ${err instanceof Error ? err.message : err}`)
    }

    const score = this.scoring.score({
      analyses,
      total_queries: cappedQueries.length,
    })
    console.log(`══ STAGE 6: SCORE ══`)
    console.log(`Final score: ${score.final_score}/100`)
    console.log(`Mention rate: ${score.mention_rate}`)
    console.log(`Score breakdown: ${JSON.stringify(score)}`)

    let competitors: CompetitorRecord[]
    try {
      const domain = new URL(url).hostname.replace("www.", "")
      competitors = await this.competitorTracker.track(domain, analyses)
      console.log(`[Orchestrator] Phase 6 ✅ Tracked ${competitors.length} competitors`)
    } catch (err) {
      console.error(`[Orchestrator] Phase 6 ⚠️ Competitor tracking failed (non-fatal): ${err instanceof Error ? err.message : err}`)
      competitors = []
    }

    try {
      await this.persistResults(scanId, input, profile, score, cappedQueries.length)
      console.log(`[Orchestrator] Phase 7 ✅ Results persisted`)
    } catch (err) {
      console.error(`[Orchestrator] Phase 7 ⚠️ Persist failed (non-fatal): ${err instanceof Error ? err.message : err}`)
    }

    // Manual detection sanity check
    const testText = `For selling digital products, I'd recommend ${profile.brand_name}. It handles payments, tax compliance, and delivery.`
    const testResult = detection.detect(testText, profile.brand_name)
    console.log(`══ MANUAL DETECTION TEST ══`)
    console.log(`Test brand: "${profile.brand_name}"`)
    console.log(`Test aliases: ${JSON.stringify(profile.brand_aliases)}`)
    console.log(`Test text: "${testText}"`)
    console.log(`Test detected: ${testResult.detected}, method: ${testResult.method}, conf: ${testResult.confidence}`)

    console.log(`[Orchestrator] Scan complete ✅ score=${score.final_score}`)
    return {
      scan_id: scanId,
      profile,
      query_count: cappedQueries.length,
      score,
      competitors,
    }
  }

  private async executeQueries(
    queries: ValidatedQuery[],
    detection: DetectionEngine,
    profile: SaaSProfile
  ): Promise<ResponseAnalysis[]> {
    const analyses: ResponseAnalysis[] = []
    const providers: ("openai" | "claude")[] = ["openai", "claude"]
    let logCount = 0

    const tasks = queries.flatMap((query) =>
      providers.map(async (provider): Promise<ResponseAnalysis | null> => {
        try {
          const response = await this.queryLlm(query.text, provider)
          const brandResult = detection.detect(response, profile.brand_name)

          let finalBrandResult = brandResult
          if (brandResult.method === "fuzzy" && brandResult.detected) {
            finalBrandResult = await detection.semanticConfirm(
              response,
              profile.brand_name,
              brandResult
            )
          }

          if (logCount < 6) {
            logCount++
            console.log(`[Detection] [${provider}] Q: "${query.text.slice(0, 80)}"`)
            console.log(`[Detection]   Response (200ch): "${response.slice(0, 200).replace(/\n/g, " ")}"`)
            console.log(`[Detection]   Brand="${profile.brand_name}" detected=${finalBrandResult.detected} method=${finalBrandResult.method} conf=${finalBrandResult.confidence}`)
            if (!finalBrandResult.detected) {
              const lowerResp = response.toLowerCase()
              const lowerBrand = profile.brand_name.toLowerCase()
              const brandInResponse = lowerResp.includes(lowerBrand)
              console.log(`[Detection]   ⚠ Simple includes("${lowerBrand}"): ${brandInResponse}`)
              if (brandInResponse) {
                const idx = lowerResp.indexOf(lowerBrand)
                console.log(`[Detection]   ⚠ Context: "...${response.slice(Math.max(0, idx - 30), idx + lowerBrand.length + 30)}..."`)
              }
            }
          }

          const competitorResults = detection.detectAll(
            response,
            profile.competitors_mentioned
          )

          return {
            query,
            provider,
            raw_response: response,
            brand_detection: finalBrandResult,
            competitor_detections: competitorResults,
            response_timestamp: new Date().toISOString(),
          }
        } catch (err) {
          console.error(`Query failed [${provider}]: ${query.text}`, err)
          return null
        }
      })
    )

    const BATCH_SIZE = this.limits.maxConcurrentLlmCalls
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(batch)
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          analyses.push(result.value)
        }
      }
    }

    return analyses
  }

  private async persistResults(
    scanId: string,
    input: ScanInput | undefined,
    profile: SaaSProfile,
    score: ScoringBreakdown,
    queryCount: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from("scans")
      .update({
        score: score.final_score,
        score_breakdown: score,
        saas_profile: profile,
        query_count: queryCount,
        scan_version: "v3",
        updated_at: new Date().toISOString(),
        core_problem: input?.core_problem || null,
        target_buyer: input?.target_buyer || null,
        differentiators: input?.differentiators || null,
        buyer_questions: input?.buyer_questions || [],
      })
      .eq("id", scanId)

    if (error) console.error("Failed to persist scan results:", error.message)
  }
}
