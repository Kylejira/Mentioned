import type { SaaSProfile } from "../profiler/types"
import type { AliasRegistry } from "./types"

/**
 * Build alias registry for ALL brands (target + competitors).
 * Deterministic — no LLM call needed.
 */
export function buildAliasRegistry(profile: SaaSProfile): AliasRegistry {
  const registry: AliasRegistry = new Map()

  registry.set(
    profile.brand_name.toLowerCase(),
    profile.brand_aliases.map((a) => a.toLowerCase())
  )

  for (const comp of profile.competitors_mentioned) {
    const aliases = generateDeterministicAliases(comp)
    registry.set(comp.toLowerCase(), aliases)
  }

  return registry
}

/**
 * Covers ~80% of real-world SaaS brand name variations.
 */
function generateDeterministicAliases(brandName: string): string[] {
  const aliases = new Set<string>()
  const lower = brandName.toLowerCase()

  aliases.add(lower)

  const domainMatch = lower.match(/^(.+)\.(com|io|so|app|dev|ai|co|org|net|chat|pro)$/)
  if (domainMatch) {
    aliases.add(domainMatch[1])
  }

  if (lower.includes("-") || lower.includes(" ")) {
    aliases.add(lower.replace(/[-\s]/g, ""))
  }

  const camelSplit = brandName.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
  if (camelSplit !== lower) {
    aliases.add(camelSplit)
    aliases.add(camelSplit.replace(/\s/g, "-"))
  }

  const parts = brandName.split(/[\s.-]+/)
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].toLowerCase()
    if (lastPart.length >= 5) {
      aliases.add(lastPart)
    }
  }

  aliases.delete(lower)
  return [...aliases]
}

/**
 * Optional: enrich competitor aliases with a single batched LLM call.
 * Cost: ~$0.005 for one GPT-4o-mini call.
 */
export async function enrichAliasesWithLlm(
  competitors: string[],
  llmCall: (prompt: string) => Promise<string>,
  existing: AliasRegistry
): Promise<AliasRegistry> {
  if (competitors.length === 0) return existing

  const prompt = `For each software product below, list 1-3 common abbreviations, alternate names, or domain variations that users might use to refer to it. If none exist, return an empty array.

Products: ${competitors.join(", ")}

Respond ONLY with JSON:
{"ProductName": ["alias1", "alias2"], ...}`

  try {
    const raw = await llmCall(prompt)
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    const parsed: Record<string, string[]> = JSON.parse(cleaned)

    for (const [name, aliases] of Object.entries(parsed)) {
      const key = name.toLowerCase()
      const current = existing.get(key) || []
      const merged = new Set([...current, ...aliases.map((a) => a.toLowerCase())])
      merged.delete(key)
      existing.set(key, [...merged])
    }
  } catch {
    console.warn("LLM alias enrichment failed, using deterministic aliases only")
  }

  return existing
}
