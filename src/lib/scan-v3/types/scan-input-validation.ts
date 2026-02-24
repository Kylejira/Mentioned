import type { ScanInput } from "./scan-input"

export interface ValidationError {
  field: keyof ScanInput
  message: string
}

const BLOCKED_DOMAINS = [
  "google.com", "facebook.com", "twitter.com", "youtube.com",
  "linkedin.com", "instagram.com", "tiktok.com", "amazon.com",
  "wikipedia.org", "reddit.com", "github.com",
]

export function validateScanInput(input: ScanInput): ValidationError[] {
  const errors: ValidationError[] = []

  const name = input.brand_name?.trim()
  if (!name || name.length === 0) {
    errors.push({ field: "brand_name", message: "Brand name is required." })
  } else if (name.length > 80) {
    errors.push({ field: "brand_name", message: "Brand name must be 80 characters or less." })
  }

  const url = input.website_url?.trim()
  if (!url) {
    errors.push({ field: "website_url", message: "Website URL is required." })
  } else {
    try {
      const parsed = new URL(url)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        errors.push({ field: "website_url", message: "URL must use http or https." })
      }
      const host = parsed.hostname.replace("www.", "")
      if (BLOCKED_DOMAINS.includes(host)) {
        errors.push({ field: "website_url", message: "Please enter your product URL, not a social media or platform site." })
      }
    } catch {
      errors.push({ field: "website_url", message: "Please enter a valid URL." })
    }
  }

  const problem = input.core_problem?.trim()
  if (!problem || problem.length < 15) {
    errors.push({
      field: "core_problem",
      message: "Please describe the problem in at least 15 characters. Be specific about the pain point.",
    })
  } else if (problem.length > 300) {
    errors.push({ field: "core_problem", message: "Please keep this under 300 characters." })
  }

  const buyer = input.target_buyer?.trim()
  if (!buyer || buyer.length < 8) {
    errors.push({
      field: "target_buyer",
      message: "Please describe your target customer in at least 8 characters.",
    })
  } else if (buyer.length > 150) {
    errors.push({ field: "target_buyer", message: "Please keep this under 150 characters." })
  }

  if (input.differentiators && input.differentiators.trim().length > 0) {
    if (input.differentiators.trim().length < 10) {
      errors.push({ field: "differentiators", message: "If provided, please give at least 10 characters." })
    } else if (input.differentiators.length > 300) {
      errors.push({ field: "differentiators", message: "Please keep this under 300 characters." })
    }
  }

  if (input.competitors && input.competitors.length > 5) {
    errors.push({ field: "competitors", message: "Maximum 5 competitors." })
  }
  if (input.competitors) {
    for (const comp of input.competitors) {
      if (comp.trim().length > 60) {
        errors.push({ field: "competitors", message: `Competitor name "${comp.slice(0, 20)}..." is too long.` })
        break
      }
    }
  }

  if (input.buyer_questions && input.buyer_questions.length > 0) {
    if (input.buyer_questions.length > 10) {
      errors.push({ field: "buyer_questions", message: "Maximum 10 questions." })
    }
    const brandLower = name?.toLowerCase() || ""
    for (const q of input.buyer_questions) {
      if (q.trim().length < 10) {
        errors.push({
          field: "buyer_questions",
          message: `"${q.slice(0, 30)}..." is too short to be a real question.`,
        })
        break
      }
      if (brandLower && q.toLowerCase().includes(brandLower)) {
        errors.push({
          field: "buyer_questions",
          message: `Questions should not contain your brand name. Remove "${name}" from: "${q.slice(0, 40)}..."`,
        })
        break
      }
    }
  }

  return errors
}
