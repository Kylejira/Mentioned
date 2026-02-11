/**
 * Brand Name Matching Utilities
 * 
 * Uses exact word boundary matching to prevent false positives.
 * For example, "Cal" should NOT match inside "Calendar" or "Calendly".
 */

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Check if a brand name is an exact match in the response text.
 * Uses word boundaries to prevent partial matches.
 * 
 * @param response - The text to search in
 * @param brandName - The brand name to look for
 * @returns true if the brand is found as a standalone word/phrase
 */
export function isExactBrandMatch(response: string, brandName: string): boolean {
  if (!response || !brandName) return false
  
  const name = brandName.trim()
  if (name.length === 0) return false
  
  const lowerResponse = response.toLowerCase()
  const lowerName = name.toLowerCase()
  
  // Check if brand has a TLD (e.g., "Cal.com", "Made.ai")
  const domainMatch = name.match(/^(.+)\.(com|ai|io|co|org|net|app|dev|xyz|me|so|to|gg)$/i)
  
  if (domainMatch) {
    const baseName = domainMatch[1]
    const escapedFull = escapeRegex(lowerName)
    const escapedBase = escapeRegex(baseName.toLowerCase())
    
    // Match full domain as word boundary
    const fullRegex = new RegExp(`\\b${escapedFull}\\b`, 'gi')
    if (fullRegex.test(response)) {
      return true
    }
    
    // Match base name but ensure it's NOT followed by common suffixes that form other words
    // e.g., "Cal" should not match "Calendar", "Calendly", "Calendaring"
    // Use negative lookahead to exclude partial matches
    const baseRegex = new RegExp(
      `(?<![a-zA-Z])${escapedBase}(?![a-zA-Z])`,
      'gi'
    )
    if (baseRegex.test(response)) {
      return true
    }
    
    return false
  }
  
  // For non-domain brand names, use word boundary matching
  const escaped = escapeRegex(lowerName)
  
  // Standard word boundary check
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
  if (regex.test(response)) {
    return true
  }
  
  // Handle CamelCase variations (PayFast -> "Pay Fast", "pay-fast")
  const camelParts = name.split(/(?=[A-Z])/).filter(p => p.length > 0)
  if (camelParts.length > 1) {
    // Check with space: "Pay Fast"
    const withSpace = camelParts.join(' ')
    const spaceRegex = new RegExp(`\\b${escapeRegex(withSpace)}\\b`, 'gi')
    if (spaceRegex.test(response)) {
      return true
    }
    
    // Check with hyphen: "Pay-Fast"
    const withHyphen = camelParts.join('-')
    const hyphenRegex = new RegExp(`\\b${escapeRegex(withHyphen)}\\b`, 'gi')
    if (hyphenRegex.test(response)) {
      return true
    }
  }
  
  // Handle brands with special characters (e.g., "HubSpot" written as "Hub Spot")
  // Only for brands 4+ chars to avoid false positives
  if (lowerName.length >= 4) {
    // Remove all separators and check as single word with boundaries
    const normalized = lowerName.replace(/[\s\-_.]/g, '')
    const normalizedRegex = new RegExp(`\\b${escapeRegex(normalized)}\\b`, 'gi')
    if (normalizedRegex.test(response.replace(/[\s\-_.]/g, ''))) {
      // Double-check: make sure this isn't a substring of a longer word in original
      // by verifying word boundaries in the original text
      const boundaryCheck = new RegExp(
        `(?<![a-zA-Z0-9])${escapeRegex(normalized)}(?![a-zA-Z0-9])`,
        'gi'
      )
      if (boundaryCheck.test(response.toLowerCase().replace(/[\s\-_.]/g, ''))) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Count the number of times a brand is mentioned in text (exact matches only)
 * 
 * @param response - The text to search in
 * @param brandName - The brand name to count
 * @returns Number of exact matches found
 */
export function countExactBrandMentions(response: string, brandName: string): number {
  if (!response || !brandName) return 0
  
  const name = brandName.trim()
  if (name.length === 0) return 0
  
  let count = 0
  const lowerName = name.toLowerCase()
  
  // Check if brand has a TLD
  const domainMatch = name.match(/^(.+)\.(com|ai|io|co|org|net|app|dev|xyz|me|so|to|gg)$/i)
  
  if (domainMatch) {
    const baseName = domainMatch[1]
    const escapedFull = escapeRegex(lowerName)
    const escapedBase = escapeRegex(baseName.toLowerCase())
    
    // Count full domain matches
    const fullRegex = new RegExp(`\\b${escapedFull}\\b`, 'gi')
    const fullMatches = response.match(fullRegex)
    if (fullMatches) count += fullMatches.length
    
    // Count base name matches (not followed by letters)
    const baseRegex = new RegExp(`(?<![a-zA-Z])${escapedBase}(?![a-zA-Z])`, 'gi')
    const baseMatches = response.match(baseRegex)
    if (baseMatches) count += baseMatches.length
    
    return count
  }
  
  // For non-domain brands
  const escaped = escapeRegex(lowerName)
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
  const matches = response.match(regex)
  if (matches) count += matches.length
  
  // Also check CamelCase variations
  const camelParts = name.split(/(?=[A-Z])/).filter(p => p.length > 0)
  if (camelParts.length > 1) {
    const withSpace = camelParts.join(' ')
    const spaceRegex = new RegExp(`\\b${escapeRegex(withSpace)}\\b`, 'gi')
    const spaceMatches = response.match(spaceRegex)
    if (spaceMatches) count += spaceMatches.length
    
    const withHyphen = camelParts.join('-')
    const hyphenRegex = new RegExp(`\\b${escapeRegex(withHyphen)}\\b`, 'gi')
    const hyphenMatches = response.match(hyphenRegex)
    if (hyphenMatches) count += hyphenMatches.length
  }
  
  return count
}

/**
 * Find the position (index) of first exact brand match in text
 * Returns -1 if not found
 * 
 * @param response - The text to search in
 * @param brandName - The brand name to find
 * @returns Index of first match, or -1 if not found
 */
export function findExactBrandPosition(response: string, brandName: string): number {
  if (!response || !brandName) return -1
  
  const name = brandName.trim()
  if (name.length === 0) return -1
  
  const lowerName = name.toLowerCase()
  
  // Check if brand has a TLD
  const domainMatch = name.match(/^(.+)\.(com|ai|io|co|org|net|app|dev|xyz|me|so|to|gg)$/i)
  
  if (domainMatch) {
    const baseName = domainMatch[1]
    const escapedFull = escapeRegex(lowerName)
    const escapedBase = escapeRegex(baseName.toLowerCase())
    
    // Find full domain first
    const fullRegex = new RegExp(`\\b${escapedFull}\\b`, 'gi')
    const fullMatch = fullRegex.exec(response)
    if (fullMatch) return fullMatch.index
    
    // Then base name
    const baseRegex = new RegExp(`(?<![a-zA-Z])${escapedBase}(?![a-zA-Z])`, 'gi')
    const baseMatch = baseRegex.exec(response)
    if (baseMatch) return baseMatch.index
    
    return -1
  }
  
  // For non-domain brands
  const escaped = escapeRegex(lowerName)
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
  const match = regex.exec(response)
  if (match) return match.index
  
  // Check CamelCase variations
  const camelParts = name.split(/(?=[A-Z])/).filter(p => p.length > 0)
  if (camelParts.length > 1) {
    const withSpace = camelParts.join(' ')
    const spaceRegex = new RegExp(`\\b${escapeRegex(withSpace)}\\b`, 'gi')
    const spaceMatch = spaceRegex.exec(response)
    if (spaceMatch) return spaceMatch.index
    
    const withHyphen = camelParts.join('-')
    const hyphenRegex = new RegExp(`\\b${escapeRegex(withHyphen)}\\b`, 'gi')
    const hyphenMatch = hyphenRegex.exec(response)
    if (hyphenMatch) return hyphenMatch.index
  }
  
  return -1
}

/**
 * Generate all variations of a brand name for matching
 * Useful for building comprehensive search patterns
 * 
 * @param brandName - The brand name
 * @returns Array of brand name variations
 */
export function getBrandVariations(brandName: string): string[] {
  const name = brandName.trim()
  if (!name) return []
  
  const variations: Set<string> = new Set()
  variations.add(name)
  variations.add(name.toLowerCase())
  variations.add(name.toUpperCase())
  
  // Handle TLD brands
  const domainMatch = name.match(/^(.+)\.(com|ai|io|co|org|net|app|dev|xyz|me|so|to|gg)$/i)
  if (domainMatch) {
    const baseName = domainMatch[1]
    variations.add(baseName)
    variations.add(baseName.toLowerCase())
    variations.add(baseName.toUpperCase())
  }
  
  // CamelCase variations
  const camelParts = name.split(/(?=[A-Z])/).filter(p => p.length > 0)
  if (camelParts.length > 1) {
    variations.add(camelParts.join(' '))
    variations.add(camelParts.join('-'))
    variations.add(camelParts.join('_'))
    variations.add(camelParts.join('').toLowerCase())
  }
  
  // Handle hyphenated/spaced brands
  const parts = name.split(/[\s\-_]+/).filter(p => p.length > 0)
  if (parts.length > 1) {
    variations.add(parts.join(''))
    variations.add(parts.join(' '))
    variations.add(parts.join('-'))
  }
  
  return Array.from(variations)
}

/**
 * Check if two brand names refer to the same brand
 * (handles variations like "Cal.com" vs "Cal", "PayFast" vs "Pay Fast")
 * 
 * @param brand1 - First brand name
 * @param brand2 - Second brand name
 * @returns true if they likely refer to the same brand
 */
export function isSameBrand(brand1: string, brand2: string): boolean {
  if (!brand1 || !brand2) return false
  
  const normalize = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\.(com|ai|io|co|org|net|app|dev|xyz|me|so|to|gg)$/i, '')
      .replace(/[\s\-_.']+/g, '')
  }
  
  return normalize(brand1) === normalize(brand2)
}
