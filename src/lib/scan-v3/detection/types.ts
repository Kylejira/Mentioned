import type { ValidatedQuery } from "../queries/types"

export interface DetectionResult {
  brand_name: string
  detected: boolean
  confidence: number
  method: "regex" | "fuzzy" | "alias" | "semantic"
  position: number | null
  snippet: string
}

export interface ResponseAnalysis {
  query: ValidatedQuery
  provider: "openai" | "claude"
  raw_response: string
  brand_detection: DetectionResult
  competitor_detections: DetectionResult[]
  response_timestamp: string
}

export interface BrandProfile {
  name: string
  aliases: string[]
}

/** Canonical brand name → list of aliases */
export type AliasRegistry = Map<string, string[]>
