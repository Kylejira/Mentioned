import { describe, it, expect } from "vitest"
import { ScoringEngine } from "@/lib/scan-v3/scoring/scoring-engine"
import type { ResponseAnalysis } from "@/lib/scan-v3/detection/types"
import type { ValidatedQuery } from "@/lib/scan-v3/queries/types"

function makeQuery(text: string, intent: string): ValidatedQuery {
  return {
    text,
    intent: intent as ValidatedQuery["intent"],
    generated_by: "llm",
    is_relevant: true,
    intent_score: 5,
    has_brand_bias: false,
    dedupe_hash: text,
  }
}

function makeAnalysis(
  query: ValidatedQuery,
  provider: "openai" | "claude",
  detected: boolean,
  position: number | null = null
): ResponseAnalysis {
  return {
    query,
    provider,
    raw_response: "test response",
    brand_detection: {
      brand_name: "TestBrand",
      detected,
      confidence: detected ? 1.0 : 0,
      method: "regex",
      position,
      snippet: "",
    },
    competitor_detections: [],
    response_timestamp: new Date().toISOString(),
  }
}

describe("ScoringEngine", () => {
  const engine = new ScoringEngine()

  it("returns 0 for empty input", () => {
    const result = engine.score({ analyses: [], total_queries: 0 })
    expect(result.final_score).toBe(0)
    expect(result.mention_rate).toBe(0)
  })

  it("scores 100 when mentioned in every query at position 1", () => {
    const q = makeQuery("best tools", "direct_recommendation")
    const analyses = [
      makeAnalysis(q, "openai", true, 1),
      makeAnalysis(q, "claude", true, 1),
    ]
    const result = engine.score({ analyses, total_queries: 1 })
    expect(result.final_score).toBe(100)
    expect(result.mention_rate).toBe(1)
    expect(result.cross_model_consistency).toBe(1)
  })

  it("scores 0 when never mentioned", () => {
    const q = makeQuery("best tools", "direct_recommendation")
    const analyses = [
      makeAnalysis(q, "openai", false),
      makeAnalysis(q, "claude", false),
    ]
    const result = engine.score({ analyses, total_queries: 1 })
    expect(result.final_score).toBe(0)
    expect(result.mention_rate).toBe(0)
  })

  it("penalizes lower positions", () => {
    const q = makeQuery("best tools", "direct_recommendation")
    const pos1 = engine.score({
      analyses: [makeAnalysis(q, "openai", true, 1)],
      total_queries: 1,
    })
    const pos4 = engine.score({
      analyses: [makeAnalysis(q, "openai", true, 4)],
      total_queries: 1,
    })
    expect(pos1.final_score).toBeGreaterThan(pos4.final_score)
  })

  it("applies cross-model consistency penalty for disagreement", () => {
    const q = makeQuery("best tools", "direct_recommendation")
    const consistent = engine.score({
      analyses: [
        makeAnalysis(q, "openai", true),
        makeAnalysis(q, "claude", true),
      ],
      total_queries: 1,
    })
    const inconsistent = engine.score({
      analyses: [
        makeAnalysis(q, "openai", true),
        makeAnalysis(q, "claude", false),
      ],
      total_queries: 1,
    })
    expect(consistent.cross_model_consistency).toBe(1.0)
    expect(inconsistent.cross_model_consistency).toBe(0.6)
    expect(consistent.final_score).toBeGreaterThan(inconsistent.final_score)
  })

  it("applies intent weights correctly", () => {
    const highIntent = makeQuery("recommend a tool", "direct_recommendation")
    const lowIntent = makeQuery("cheapest option", "budget_based")

    // With mixed detection, the detected query's weight should influence the score.
    // Detect only the high-intent query → higher intent score
    const highDetected = engine.score({
      analyses: [
        makeAnalysis(highIntent, "openai", true),
        makeAnalysis(lowIntent, "openai", false),
      ],
      total_queries: 2,
    })
    // Detect only the low-intent query → lower intent score
    const lowDetected = engine.score({
      analyses: [
        makeAnalysis(highIntent, "openai", false),
        makeAnalysis(lowIntent, "openai", true),
      ],
      total_queries: 2,
    })
    expect(highDetected.intent_weighted_score).toBeGreaterThan(lowDetected.intent_weighted_score)
  })

  it("applies competitor density penalty", () => {
    const q = makeQuery("best tools", "direct_recommendation")
    const withCompetitors: ResponseAnalysis = {
      ...makeAnalysis(q, "openai", true),
      competitor_detections: [
        { brand_name: "Comp1", detected: true, confidence: 1, method: "regex", position: null, snippet: "" },
        { brand_name: "Comp2", detected: true, confidence: 1, method: "regex", position: null, snippet: "" },
        { brand_name: "Comp3", detected: true, confidence: 1, method: "regex", position: null, snippet: "" },
      ],
    }
    const result = engine.score({
      analyses: [withCompetitors],
      total_queries: 1,
    })
    expect(result.competitor_density_factor).toBeLessThan(1.0)
    expect(result.competitor_density_factor).toBeGreaterThanOrEqual(0.85)
  })

  it("handles 50% mention rate correctly", () => {
    const q1 = makeQuery("best tools", "direct_recommendation")
    const q2 = makeQuery("cheap options", "budget_based")
    const analyses = [
      makeAnalysis(q1, "openai", true),
      makeAnalysis(q2, "openai", false),
    ]
    const result = engine.score({ analyses, total_queries: 2 })
    expect(result.mention_rate).toBe(0.5)
    expect(result.final_score).toBeGreaterThan(0)
    expect(result.final_score).toBeLessThan(100)
  })
})
