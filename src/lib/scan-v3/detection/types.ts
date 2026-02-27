import type { ValidatedQuery } from "../queries/types"

export interface DetectionResult {
  brand_name: string
  detected: boolean
  confidence: number
  method: "regex" | "fuzzy" | "alias" | "semantic"
  position: number | null
  snippet: string
}

export type LlmProviderName = "openai" | "claude" | "gemini"

export type BrandSentiment = "positive" | "neutral" | "negative"

export interface ResponseAnalysis {
  query: ValidatedQuery
  provider: LlmProviderName
  raw_response: string
  brand_detection: DetectionResult
  brand_sentiment: BrandSentiment | null
  competitor_detections: DetectionResult[]
  response_timestamp: string
}

export interface BrandProfile {
  name: string
  aliases: string[]
}

/** Canonical brand name → list of aliases */
export type AliasRegistry = Map<string, string[]>
