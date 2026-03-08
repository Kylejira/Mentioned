// ---------------------------------------------------------------------------
// Reply Validator — Spam prevention for AI-generated replies
// 6 validation rules that catch outputs that would look spammy if posted.
// ---------------------------------------------------------------------------

export interface ValidationResult {
  passed: boolean
  issues: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// ---------------------------------------------------------------------------
// Banned phrases — marketing language and self-disclosure patterns
// ---------------------------------------------------------------------------

const BANNED_PHRASES = [
  "game-changing",
  "revolutionary",
  "cutting-edge",
  "seamless",
  "unlock your",
  "leverage the power",
  "best-in-class",
  "check it out!",
  "you won't regret",
  "trust me on this",
  "full disclosure",
  "i'm affiliated",
  "i work for",
  "powerful tool",
  "all-in-one solution",
]

// ---------------------------------------------------------------------------
// validateReply — runs all 6 rules against a single reply
// ---------------------------------------------------------------------------

export function validateReply(
  reply: string,
  productName: string
): ValidationResult {
  const issues: string[] = []
  const lower = reply.toLowerCase()
  const productLower = productName.toLowerCase()

  // Rule 1: Product name mentioned too many times (max 2)
  const nameRegex = new RegExp(`\\b${escapeRegex(productLower)}\\b`, "g")
  const nameCount = (lower.match(nameRegex) || []).length
  if (nameCount > 2) {
    issues.push(`Product name mentioned ${nameCount} times (max 2)`)
  }

  // Rule 2: Contains banned marketing phrases
  const foundBanned = BANNED_PHRASES.filter((phrase) => lower.includes(phrase))
  if (foundBanned.length > 0) {
    issues.push(`Contains marketing language: ${foundBanned.join(", ")}`)
  }

  // Rule 3: Too many exclamation marks (max 1)
  const exclamationCount = (reply.match(/!/g) || []).length
  if (exclamationCount > 1) {
    issues.push(`Too many exclamation marks (${exclamationCount})`)
  }

  // Rule 4: Contains URL (unless platform expects links)
  if (/https?:\/\//.test(reply)) {
    issues.push("Contains URL — remove unless platform expects links")
  }

  // Rule 5: Reply too short (< 30 chars) or too long (> 1500 chars)
  if (reply.length < 30) issues.push("Reply too short")
  if (reply.length > 1500) issues.push("Reply too long")

  // Rule 6: Product is the first thing mentioned (within first 50 chars)
  if (productLower.length > 0) {
    const firstProductIndex = lower.indexOf(productLower)
    if (firstProductIndex >= 0 && firstProductIndex < 50) {
      issues.push("Product mentioned too early — should not lead with it")
    }
  }

  return { passed: issues.length === 0, issues }
}

// ---------------------------------------------------------------------------
// Stricter prompt addendum — appended when retrying after validation failures
// ---------------------------------------------------------------------------

export const STRICTER_PROMPT_ADDENDUM = `
IMPORTANT: Your previous replies were too promotional. This time:
- Mention the product ONLY ONCE and ONLY after recommending other tools.
- Do NOT include any URLs.
- Do NOT use exclamation marks near the product name.
- Keep the product mention to ONE short sentence.`
