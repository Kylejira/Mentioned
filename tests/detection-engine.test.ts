import { describe, it, expect } from "vitest"
import { DetectionEngine } from "@/lib/scan-v3/detection/detection-engine"

function makeEngine(
  brandName: string,
  aliases: string[] = [],
  aliasRegistry?: Map<string, string[]>
) {
  return new DetectionEngine(brandName, aliases, undefined, aliasRegistry)
}

describe("DetectionEngine", () => {
  describe("regex detection", () => {
    it("detects exact brand name in plain text", () => {
      const engine = makeEngine("Linear")
      const result = engine.detect("I recommend Linear for issue tracking.", "Linear")
      expect(result.detected).toBe(true)
      expect(result.method).toBe("regex")
      expect(result.confidence).toBe(1.0)
    })

    it("detects brand name case-insensitively", () => {
      const engine = makeEngine("Notion")
      const result = engine.detect("You should try NOTION for note-taking.", "Notion")
      expect(result.detected).toBe(true)
    })

    it("detects multi-word brand names", () => {
      const engine = makeEngine("Lemon Squeezy")
      const result = engine.detect(
        "For selling digital products, I'd recommend Lemon Squeezy.",
        "Lemon Squeezy"
      )
      expect(result.detected).toBe(true)
    })

    it("does not false-positive on partial matches", () => {
      const engine = makeEngine("Cal")
      const result = engine.detect("You can calculate your taxes locally.", "Cal")
      expect(result.detected).toBe(false)
    })

    it("detects brands in markdown bold", () => {
      const engine = makeEngine("Stripe")
      const result = engine.detect("1. **Stripe** - Payment processing", "Stripe")
      expect(result.detected).toBe(true)
    })

    it("detects brands inside markdown links", () => {
      const engine = makeEngine("Vercel")
      const result = engine.detect("Try [Vercel] for deployments", "Vercel")
      expect(result.detected).toBe(true)
    })

    it("detects brands preceded by markdown heading", () => {
      const engine = makeEngine("Notion")
      const result = engine.detect("## Notion\nA great tool for wikis.", "Notion")
      expect(result.detected).toBe(true)
    })

    it("returns not detected for absent brand", () => {
      const engine = makeEngine("Figma")
      const result = engine.detect("I recommend Sketch for design work.", "Figma")
      expect(result.detected).toBe(false)
      expect(result.confidence).toBe(0)
    })
  })

  describe("alias detection", () => {
    it("detects via alias when exact name absent", () => {
      const engine = makeEngine("Cal.com", ["calcom", "cal dot com"])
      const result = engine.detect("I use calcom for scheduling.", "Cal.com")
      expect(result.detected).toBe(true)
      expect(result.method).toBe("alias")
    })

    it("uses alias registry for competitors", () => {
      const registry = new Map<string, string[]>()
      registry.set("lemon squeezy", ["lemonsqueezy", "lemon-squeezy"])
      const engine = makeEngine("Linear", [], undefined, registry)
      // "Lemon Squeezy" as a full name won't regex-match "lemonsqueezy",
      // but the alias or fuzzy pipeline should detect it.
      const result = engine.detect("Try lemonsqueezy for payments.", "Lemon Squeezy")
      expect(result.detected).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.7)
    })
  })

  describe("fuzzy detection", () => {
    it("detects minor typos (Levenshtein)", () => {
      const engine = makeEngine("Calendly")
      const result = engine.detect("You should try Calndly for scheduling.", "Calendly")
      expect(result.detected).toBe(true)
      expect(result.method).toBe("fuzzy")
    })

    it("does not trigger fuzzy for short brands", () => {
      const engine = makeEngine("Arc")
      const result = engine.detect("Try Art for browsing.", "Arc")
      expect(result.detected).toBe(false)
    })

    it("rejects low-similarity fuzzy matches", () => {
      const engine = makeEngine("Figma")
      const result = engine.detect("Use Format for your portfolio.", "Figma")
      expect(result.detected).toBe(false)
    })
  })

  describe("position extraction", () => {
    it("extracts numbered list position", () => {
      const engine = makeEngine("Asana")
      const result = engine.detect(
        "Top tools:\n1. Monday\n2. Asana\n3. Trello",
        "Asana"
      )
      expect(result.detected).toBe(true)
      expect(result.position).toBe(2)
    })

    it("extracts position from bold rankings", () => {
      const engine = makeEngine("Linear")
      const result = engine.detect(
        "**Monday** is popular. **Linear** is great for devs. **Jira** is enterprise.",
        "Linear"
      )
      expect(result.detected).toBe(true)
      expect(result.position).toBe(2)
    })

    it("returns null position when no list structure", () => {
      const engine = makeEngine("Stripe")
      const result = engine.detect("Stripe is a payment processor.", "Stripe")
      expect(result.detected).toBe(true)
      expect(result.position).toBeNull()
    })
  })

  describe("detectAll (symmetric)", () => {
    it("detects multiple brands in one response", () => {
      const engine = makeEngine("Linear")
      const results = engine.detectAll(
        "Linear and Jira are both good. Asana is also worth considering.",
        ["Linear", "Jira", "Asana", "Notion"]
      )
      expect(results).toHaveLength(4)
      expect(results[0].detected).toBe(true) // Linear
      expect(results[1].detected).toBe(true) // Jira
      expect(results[2].detected).toBe(true) // Asana
      expect(results[3].detected).toBe(false) // Notion
    })
  })
})
