export { ScanOrchestrator } from "./orchestrator"
export type { ScanResult, ProgressCallback } from "./orchestrator"

export { SaaSProfiler } from "./profiler/saas-profiler"
export type { SaaSProfile } from "./profiler/types"

export { QueryGenerator } from "./queries/query-generator"
export { QueryValidator } from "./queries/query-validator"
export { QueryRepository } from "./queries/query-repository"
export type { GeneratedQuery, ValidatedQuery, IntentCluster, QuerySet } from "./queries/types"

export { DetectionEngine } from "./detection/detection-engine"
export { buildAliasRegistry, enrichAliasesWithLlm } from "./detection/alias-builder"
export type { DetectionResult, ResponseAnalysis, AliasRegistry, LlmProviderName } from "./detection/types"

export { ScoringEngine } from "./scoring/scoring-engine"
export { SCORING_WEIGHTS } from "./scoring/weights"
export type { ScoringInput, ScoringBreakdown, ProviderScore } from "./scoring/types"

export { CompetitorTracker } from "./competitors/competitor-tracker"
export type { CompetitorSnapshot, CompetitorRecord } from "./competitors/types"

export { resolveLimits } from "./config/scan-limits"
export type { PlanTier, ScanLimits } from "./config/scan-limits"

export type { ScanInput } from "./types/scan-input"
export { validateScanInput } from "./types/scan-input-validation"
export type { ValidationError } from "./types/scan-input-validation"
