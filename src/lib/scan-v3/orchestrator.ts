import pLimit from "p-limit"
import type { SupabaseClient } from "@supabase/supabase-js"
import { log } from "@/lib/logger"
import { SaaSProfiler } from "./profiler/saas-profiler"

const logger = log.create("orchestrator")
import { QueryGenerator } from "./queries/query-generator"
import { QueryValidator } from "./queries/query-validator"
import { QueryRepository } from "./queries/query-repository"
import { DetectionEngine } from "./detection/detection-engine"
import { classifySentiment } from "./detection/sentiment-classifier"
import { buildAliasRegistry, enrichAliasesWithLlm } from "./detection/alias-builder"
import { ScoringEngine } from "./scoring/scoring-engine"
import { CompetitorTracker } from "./competitors/competitor-tracker"
import { resolveLimits, type PlanTier, type ScanLimits } from "./config/scan-limits"
import type { ScanInput } from "./types/scan-input"
import type { SaaSProfile } from "./profiler/types"
import type { ValidatedQuery } from "./queries/types"
import type { ResponseAnalysis, LlmProviderName } from "./detection/types"
import type { ScoringBreakdown } from "./scoring/types"
import type { CompetitorRecord } from "./competitors/types"

export type ProgressCallback = (progress: number, stage: string) => void | Promise<void>

export interface ScanResult {
  scan_id: string
  profile: SaaSProfile
  query_count: number
  score: ScoringBreakdown
  competitors: CompetitorRecord[]
  analyses: ResponseAnalysis[]
}

export class ScanOrchestrator {
  private limits: ScanLimits
  private profiler: SaaSProfiler
  private generator: QueryGenerator
  private queryRepo: QueryRepository
  private scoring: ScoringEngine
  private competitorTracker: CompetitorTracker
  private activeProviders: LlmProviderName[]

  constructor(
    private supabase: SupabaseClient,
    private llmCall: (prompt: string) => Promise<string>,
    private queryLlm: (query: string, provider: LlmProviderName) => Promise<string>,
    private scrapeUrl: (url: string) => Promise<string>,
    plan: PlanTier = "free",
    activeProviders?: LlmProviderName[],
    limitsOverride?: Partial<ScanLimits>
  ) {
    this.limits = { ...resolveLimits(plan), ...limitsOverride }
    this.activeProviders = activeProviders ?? ["openai", "claude"]
    this.profiler = new SaaSProfiler(llmCall, scrapeUrl)
    this.generator = new QueryGenerator(llmCall, this.limits)
    this.queryRepo = new QueryRepository(supabase)
    this.scoring = new ScoringEngine()
    this.competitorTracker = new CompetitorTracker(supabase)
  }

  async runScan(scanId: string, url: string, input?: ScanInput, onProgress?: ProgressCallback): Promise<ScanResult> {
    const report = async (progress: number, stage: string) => {
      if (onProgress) {
        try { await onProgress(progress, stage) } catch { /* non-fatal */ }
      }
    }

    logger.info("Starting scan", { scanId, url })
    await report(5, "profiling")

    logger.debug("Stage 1: scan input", {
      brand: input?.brand_name || "N/A",
      url,
      competitors: input?.competitors || [],
      core_problem: input?.core_problem || "N/A",
      target_buyer: input?.target_buyer || "N/A",
    })

    let profile: SaaSProfile
    try {
      profile = await this.profiler.profile(url, input)
      logger.debug("Stage 2: profile", {
        brand_name: profile.brand_name,
        brand_aliases: profile.brand_aliases,
        category: profile.category,
        competitors_mentioned: profile.competitors_mentioned,
        core_problem: profile.core_problem || "N/A",
        target_buyer: profile.target_buyer || "N/A",
      })
    } catch (err) {
      throw new Error(`Phase 1 (Profile) failed: ${err instanceof Error ? err.message : err}`)
    }

    await report(20, "generating_queries")

    let cappedQueries: ValidatedQuery[]
    try {
      const rawQueries = await this.generator.generate(profile)
      const validator = new QueryValidator(this.llmCall)
      const validatedQueries = await validator.validate(rawQueries, profile)
      cappedQueries = validatedQueries.slice(0, this.limits.maxQueries)
      const intentDist: Record<string, number> = {}
      for (const q of cappedQueries) { intentDist[q.intent] = (intentDist[q.intent] || 0) + 1 }
      logger.debug("Stage 3: queries", {
        raw_count: rawQueries.length,
        validated_count: validatedQueries.length,
        capped_count: cappedQueries.length,
        max_queries: this.limits.maxQueries,
        sample_queries: cappedQueries.slice(0, 5).map(q => q.text),
        intent_distribution: intentDist,
      })
    } catch (err) {
      throw new Error(`Phase 2 (Query Gen) failed: ${err instanceof Error ? err.message : err}`)
    }

    try {
      await this.queryRepo.store(scanId, cappedQueries)
      logger.info("Phase 2c: stored queries", { count: cappedQueries.length })
    } catch (err) {
      logger.error("Phase 2c: query store failed (non-fatal)", { error: String(err instanceof Error ? err.message : err) })
    }

    await report(35, "executing_queries")

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
      logger.info("Phase 3: alias registry built")
    } catch (err) {
      throw new Error(`Phase 3 (Alias) failed: ${err instanceof Error ? err.message : err}`)
    }

    let analyses: ResponseAnalysis[]
    try {
      analyses = await this.executeQueries(cappedQueries, detection, profile)
      const mentionsFound = analyses.filter(a => a.brand_detection.detected).length
      const methodsUsed = [...new Set(analyses.map(a => a.brand_detection.method))]
      const byProvider: Record<string, { total: number; detected: number }> = {}
      for (const a of analyses) {
        if (!byProvider[a.provider]) byProvider[a.provider] = { total: 0, detected: 0 }
        byProvider[a.provider].total++
        if (a.brand_detection.detected) byProvider[a.provider].detected++
      }
      const emptyResponses = analyses.filter(a => !a.raw_response || a.raw_response.trim().length === 0).length
      logger.debug("Stage 5: detection results", {
        total_analyses: analyses.length,
        mentions_found: mentionsFound,
        detection_methods: methodsUsed,
        by_provider: byProvider,
        empty_responses: emptyResponses,
      })
    } catch (err) {
      throw new Error(`Phase 4 (Execute) failed: ${err instanceof Error ? err.message : err}`)
    }

    await report(80, "scoring")

    const score = this.scoring.score({
      analyses,
      total_queries: cappedQueries.length,
    })
    logger.debug("Stage 6: score", {
      final_score: score.final_score,
      mention_rate: score.mention_rate,
      score_breakdown: score,
    })

    await report(90, "finalizing")

    let competitors: CompetitorRecord[]
    try {
      const domain = new URL(url).hostname.replace("www.", "")
      competitors = await this.competitorTracker.track(domain, analyses)
      logger.info("Phase 6: tracked competitors", { count: competitors.length })
    } catch (err) {
      logger.error("Phase 6: competitor tracking failed (non-fatal)", { error: String(err instanceof Error ? err.message : err) })
      competitors = []
    }

    try {
      await this.persistResults(scanId, input, profile, score, cappedQueries.length)
      logger.info("Phase 7: results persisted")
    } catch (err) {
      logger.error("Phase 7: persist failed (non-fatal)", { error: String(err instanceof Error ? err.message : err) })
    }

    await report(100, "complete")

    logger.info("Scan complete", { score: score.final_score })
    return {
      scan_id: scanId,
      profile,
      query_count: cappedQueries.length,
      score,
      competitors,
      analyses,
    }
  }

  private async executeQueries(
    queries: ValidatedQuery[],
    detection: DetectionEngine,
    profile: SaaSProfile
  ): Promise<ResponseAnalysis[]> {
    const analyses: ResponseAnalysis[] = []
    const providers = this.activeProviders
    let logCount = 0

    logger.info("Executing queries", { queryCount: queries.length, providers })

    const limit = pLimit(this.limits.maxConcurrentLlmCalls)

    const tasks = queries.flatMap((query) =>
      providers.map((provider) =>
        limit(async (): Promise<ResponseAnalysis | null> => {
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
              logger.debug("Detection detail", {
                provider,
                query_preview: query.text.slice(0, 80),
                response_preview: response.slice(0, 200).replace(/\n/g, " "),
                brand: profile.brand_name,
                detected: finalBrandResult.detected,
                method: finalBrandResult.method,
                confidence: finalBrandResult.confidence,
              })
              if (!finalBrandResult.detected) {
                const lowerResp = response.toLowerCase()
                const lowerBrand = profile.brand_name.toLowerCase()
                const brandInResponse = lowerResp.includes(lowerBrand)
                logger.debug("Detection: simple includes check", { lowerBrand, brandInResponse })
                if (brandInResponse) {
                  const idx = lowerResp.indexOf(lowerBrand)
                  logger.debug("Detection: context around brand", { context: response.slice(Math.max(0, idx - 30), idx + lowerBrand.length + 30) })
                }
              }
            }

            const sentiment = finalBrandResult.detected
              ? classifySentiment(response, profile.brand_name)
              : null

            const competitorResults = detection.detectAll(
              response,
              profile.competitors_mentioned
            )

            return {
              query,
              provider,
              raw_response: response,
              brand_detection: finalBrandResult,
              brand_sentiment: sentiment,
              competitor_detections: competitorResults,
              response_timestamp: new Date().toISOString(),
            }
          } catch (err) {
            logger.error("Query failed", { provider, query: query.text, error: String(err) })
            return null
          }
        })
      )
    )

    const results = await Promise.allSettled(tasks)
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        analyses.push(result.value)
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
        provider_scores: score.provider_scores,
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

    if (error) logger.error("Failed to persist scan results", { error: error.message })
  }
}
