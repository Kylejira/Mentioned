import type { DetectionResult, AliasRegistry } from "./types"

/**
 * Multi-stage detection pipeline: regex → alias → fuzzy → semantic.
 * Refinement 3: symmetric detection for target brand AND competitors
 * via shared AliasRegistry.
 */
export class DetectionEngine {
  private aliasRegistry: AliasRegistry

  constructor(
    private brandName: string,
    brandAliases: string[],
    private llmCall?: (prompt: string) => Promise<string>,
    aliasRegistry?: AliasRegistry
  ) {
    this.aliasRegistry = aliasRegistry ?? new Map()
    if (!this.aliasRegistry.has(brandName.toLowerCase())) {
      this.aliasRegistry.set(
        brandName.toLowerCase(),
        brandAliases.map((a) => a.toLowerCase())
      )
    }
  }

  /**
   * Full pipeline for any brand — target or competitor.
   */
  detect(responseText: string, targetBrand: string): DetectionResult {
    const regexResult = this.regexMatch(responseText, targetBrand)
    if (regexResult.detected && regexResult.confidence >= 0.95) {
      return {
        ...regexResult,
        position: this.extractPosition(responseText, targetBrand),
      }
    }

    const aliases = this.aliasRegistry.get(targetBrand.toLowerCase()) || []
    for (const alias of aliases) {
      const aliasResult = this.regexMatch(responseText, alias)
      if (aliasResult.detected) {
        return {
          brand_name: targetBrand,
          detected: true,
          confidence: 1.0,
          method: "alias",
          position: this.extractPosition(responseText, alias),
          snippet: aliasResult.snippet,
        }
      }
    }

    const fuzzyResult = this.fuzzyMatch(responseText, targetBrand)
    if (fuzzyResult.detected) {
      return {
        ...fuzzyResult,
        position: this.extractPosition(responseText, targetBrand),
      }
    }

    return {
      brand_name: targetBrand,
      detected: false,
      confidence: 0,
      method: "regex",
      position: null,
      snippet: "",
    }
  }

  /**
   * Semantic confirmation — call ONLY when fuzzy match triggered.
   */
  async semanticConfirm(
    responseText: string,
    targetBrand: string,
    fuzzyResult: DetectionResult
  ): Promise<DetectionResult> {
    if (!this.llmCall) return fuzzyResult

    const prompt = `Does the following text mention or recommend the product "${targetBrand}"?
Answer ONLY "yes" or "no".

Text: "${fuzzyResult.snippet}"`

    try {
      const answer = (await this.llmCall(prompt)).trim().toLowerCase()
      const confirmed = answer.startsWith("yes")
      return {
        ...fuzzyResult,
        method: "semantic",
        confidence: confirmed ? Math.min(fuzzyResult.confidence + 0.2, 1.0) : 0,
        detected: confirmed,
      }
    } catch {
      return fuzzyResult
    }
  }

  /**
   * Symmetric detection for all brands in a response.
   */
  detectAll(responseText: string, brandNames: string[]): DetectionResult[] {
    return brandNames.map((name) => this.detect(responseText, name))
  }

  // --- Regex matcher ---

  private regexMatch(text: string, brand: string): DetectionResult {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(
      `(?:^|[\\s,;:("'\\-])` + escaped + `(?:[\\s,;:)"'\\-.!?]|$)`,
      "i"
    )
    const match = pattern.exec(text)

    return {
      brand_name: brand,
      detected: !!match,
      confidence: match ? 1.0 : 0,
      method: "regex",
      position: null,
      snippet: match
        ? text.slice(Math.max(0, match.index - 50), match.index + 100)
        : "",
    }
  }

  // --- Fuzzy matcher (Levenshtein) ---

  private fuzzyMatch(text: string, brand: string): DetectionResult {
    if (brand.length < 4) {
      return { brand_name: brand, detected: false, confidence: 0, method: "fuzzy", position: null, snippet: "" }
    }

    const words = text.split(/\s+/)
    const brandLower = brand.toLowerCase()
    let bestScore = 0
    let bestWord = ""

    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase()
      if (cleanWord.length < 3) continue
      if (Math.abs(cleanWord.length - brandLower.length) > brandLower.length * 0.3) continue

      const distance = this.levenshtein(cleanWord, brandLower)
      const maxLen = Math.max(cleanWord.length, brandLower.length)
      const similarity = 1 - distance / maxLen

      if (similarity > bestScore) {
        bestScore = similarity
        bestWord = word
      }
    }

    const threshold = brandLower.length <= 7 ? 0.8 : 0.75
    const detected = bestScore >= threshold

    const wordIndex = text.indexOf(bestWord)
    return {
      brand_name: brand,
      detected,
      confidence: detected ? Math.round(bestScore * 100) / 100 : 0,
      method: "fuzzy",
      position: null,
      snippet: detected
        ? text.slice(Math.max(0, wordIndex - 50), wordIndex + 100)
        : "",
    }
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length
    const n = b.length
    const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)

    for (let i = 1; i <= m; i++) {
      let prev = i - 1
      dp[0] = i
      for (let j = 1; j <= n; j++) {
        const temp = dp[j]
        dp[j] =
          a[i - 1] === b[j - 1]
            ? prev
            : 1 + Math.min(prev, dp[j], dp[j - 1])
        prev = temp
      }
    }
    return dp[n]
  }

  // --- Position extraction ---

  private extractPosition(text: string, brand: string): number | null {
    const lines = text.split("\n")
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const brandRegex = new RegExp(escaped, "i")

    for (const line of lines) {
      const listMatch = line.match(/^[\s]*(\d+)[.)]\s/)
      if (listMatch && brandRegex.test(line)) {
        return parseInt(listMatch[1], 10)
      }
    }

    const boldPattern = /\*\*([^*]+)\*\*/g
    let match: RegExpExecArray | null
    let position = 0
    while ((match = boldPattern.exec(text)) !== null) {
      position++
      if (brandRegex.test(match[1])) {
        return position
      }
    }

    return null
  }
}
