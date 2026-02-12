/**
 * Word-boundary brand matching
 * Prevents false positives: "Cal" in "Calcium", "Notion" in "notional", "Copy.ai" in "copyright"
 */

/**
 * Check if a brand name appears in a response using word boundary regex.
 * Handles TLD brands like Cal.com, Otter.ai, Copy.ai correctly.
 */
export function isExactBrandMatch(response: string, brandName: string): boolean {
  if (!response || !brandName) return false

  const name = brandName.trim()
  const lowerName = name.toLowerCase()

  // Handle TLD brands like Cal.com, Otter.ai, Copy.ai
  const domainMatch = name.match(/^(.+)\.(com|ai|io|co|org|net)$/i)

  if (domainMatch) {
    const baseName = domainMatch[1]
    const lowerBase = baseName.toLowerCase()
    const tld = domainMatch[2]

    const escapedFull = lowerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const escapedBase = lowerBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Match full domain (cal.com, cal dot com, calcom)
    const fullRegex = new RegExp(`\\b${escapedFull}\\b`, 'gi')
    const spacedRegex = new RegExp(`\\b${escapedBase}\\s*\\.\\s*${tld}\\b`, 'gi')
    const noDotsRegex = new RegExp(`\\b${escapedBase}${tld}\\b`, 'gi')

    // Match base name as standalone word only (Cal in "I recommend Cal" but not "calcium")
    const baseRegex = new RegExp(`(?<![a-zA-Z])${escapedBase}(?![a-zA-Z])`, 'gi')

    return (
      fullRegex.test(response) ||
      spacedRegex.test(response) ||
      noDotsRegex.test(response) ||
      baseRegex.test(response)
    )
  }

  // Standard brand: match as whole word only
  const escaped = lowerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
  return regex.test(response)
}

/**
 * Find the evidence (surrounding text) for a brand match.
 * Returns the matched snippet or null if no match.
 */
export function findBrandMatchEvidence(
  response: string,
  brandName: string
): string | null {
  if (!response || !brandName) return null

  const name = brandName.trim()
  const lowerName = name.toLowerCase()

  // Handle TLD brands
  const domainMatch = name.match(/^(.+)\.(com|ai|io|co|org|net)$/i)

  let match: RegExpExecArray | null = null

  if (domainMatch) {
    const baseName = domainMatch[1]
    const lowerBase = baseName.toLowerCase()
    const tld = domainMatch[2]
    const escapedFull = lowerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const escapedBase = lowerBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const patterns = [
      new RegExp(`\\b${escapedFull}\\b`, 'gi'),
      new RegExp(`\\b${escapedBase}\\s*\\.\\s*${tld}\\b`, 'gi'),
      new RegExp(`\\b${escapedBase}${tld}\\b`, 'gi'),
      new RegExp(`(?<![a-zA-Z])${escapedBase}(?![a-zA-Z])`, 'gi'),
    ]

    for (const regex of patterns) {
      match = regex.exec(response)
      if (match) break
    }
  } else {
    const escaped = lowerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    match = regex.exec(response)
  }

  if (!match) return null

  const index = match.index
  const start = Math.max(0, index - 20)
  const end = Math.min(response.length, index + match[0].length + 50)
  const evidence = response.substring(start, end).trim()
  return `...${evidence}...`
}
