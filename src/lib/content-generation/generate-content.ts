import OpenAI from "openai"
import { log } from "@/lib/logger"
import type { ActionItem, ProductData } from "./types"

const logger = log.create("content-gen")

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured")
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openai
}

export async function generateContent(
  action: ActionItem,
  productData: ProductData,
  topCompetitors: string[],
  generateType: string
): Promise<{ success: boolean; content: string; error?: string }> {
  const client = getOpenAI()
  logger.info("Generating content", { type: generateType, product: productData.product_name })

  let prompt: string

  switch (generateType) {
    case "comparison_page": {
      const competitor = topCompetitors[0] || "Competitor"
      prompt = `Write a comparison page: "${productData.product_name} vs ${competitor}"

PRODUCT INFO:
- Name: ${productData.product_name}
- Category: ${productData.category}
- Description: ${productData.one_line_description}
- Target audience: ${productData.target_audience.who}
- Key features: ${productData.key_features.slice(0, 5).join(", ")}
- Unique selling points: ${productData.unique_selling_points.join(", ")}

Write a comparison page with:
1. H1: "${productData.product_name} vs ${competitor}: Which is Right for You?"
2. Introduction (2-3 sentences)
3. Quick comparison table (features, pricing, best for)
4. Detailed comparison sections (3-4 sections)
5. When to choose ${productData.product_name}
6. When to choose ${competitor}
7. Balanced conclusion

TONE: Honest and fair, subtly favor ${productData.product_name}
LENGTH: 800-1000 words
FORMAT: Markdown`
      break
    }

    case "headline":
      prompt = `Generate 5 homepage headline options for ${productData.product_name}.

PRODUCT:
- Description: ${productData.one_line_description}
- Category: ${productData.category}
- Target audience: ${productData.target_audience.who}
- Unique value: ${productData.unique_selling_points[0] || ""}

Each headline MUST state the category clearly, under 10 words, modern tone, action-oriented.

Return as a numbered list with brief notes on why each works.`
      break

    case "faq":
      prompt = `Create a comprehensive FAQ section for ${productData.product_name}.

PRODUCT:
- Name: ${productData.product_name}
- Category: ${productData.category}
- Description: ${productData.one_line_description}
- Target audience: ${productData.target_audience.who}
- Key features: ${productData.key_features.slice(0, 5).join(", ")}
- Pricing model: ${productData.pricing_model}

Generate 10 FAQs covering: what it is, who it's for, differentiators, pricing, features, and common audience questions.

FORMAT:
## Frequently Asked Questions

### Q: [Question]
[Answer in 2-4 sentences]`
      break

    case "testimonial_email":
      prompt = `Write a short email requesting a testimonial from a customer of ${productData.product_name}.

PRODUCT:
- Name: ${productData.product_name}
- Category: ${productData.category}
- Target audience: ${productData.target_audience.who}

Under 150 words, friendly, not pushy. Include 3 prompt questions about problem solved, results, and who they'd recommend to.

Subject: [Subject line]
[Email body]`
      break

    case "use_case_page": {
      const useCase = productData.use_cases[0] || productData.target_audience.who
      prompt = `Write a use-case landing page: "${productData.product_name} for ${useCase}"

PRODUCT:
- Name: ${productData.product_name}
- Category: ${productData.category}
- Description: ${productData.one_line_description}
- Key features: ${productData.key_features.slice(0, 5).join(", ")}

Include: H1, subheadline, pain points (3-4), solution section, key features, social proof placeholder, CTA.

LENGTH: 500-700 words
FORMAT: Markdown`
      break
    }

    default:
      return { success: false, content: "", error: `Unknown content type: ${generateType}` }
  }

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Content generation timeout after 15s")), 15000)
      ),
    ])

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error("Empty response from OpenAI")

    logger.info("Content generated", { type: generateType, chars: content.length })
    return { success: true, content }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("Content generation failed", { type: generateType, error: errorMessage })
    return { success: false, content: "", error: errorMessage }
  }
}
