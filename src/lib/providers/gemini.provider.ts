import type { AIProvider } from "./provider.types"
import { log } from "@/lib/logger"

const logger = log.create("gemini-provider")

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

export interface GeminiProviderConfig {
  model?: string
  maxTokens?: number
  temperature?: number
}

interface GeminiCandidate {
  content?: {
    parts?: { text?: string }[]
  }
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
  error?: { message: string; code: number }
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini"
  private model: string
  private maxTokens: number
  private temperature: number

  constructor(config: GeminiProviderConfig = {}) {
    this.model = config.model ?? "gemini-2.5-flash"
    this.maxTokens = config.maxTokens ?? 1500
    this.temperature = config.temperature ?? 0.3
  }

  async generateResponse(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set")
    }

    const url = `${GEMINI_API_BASE}/${this.model}:generateContent?key=${apiKey}`

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature: this.temperature,
      },
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorText = await res.text()
      logger.error("Gemini API request failed", { status: res.status, error: errorText })
      throw new Error(`Gemini API error ${res.status}: ${errorText}`)
    }

    const data = (await res.json()) as GeminiResponse

    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`)
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
    return text
  }
}

/**
 * Standalone test to verify Gemini connectivity and response format.
 * Run via: npx tsx -e "import('./src/lib/providers/gemini.provider').then(m => m.testGeminiProvider())"
 */
export async function testGeminiProvider(): Promise<void> {
  console.log("Testing Gemini provider...")

  const provider = new GeminiProvider()
  console.log(`Model: ${provider.name}`)

  try {
    const response = await provider.generateResponse(
      "What are the top 3 project management tools for software teams? Keep your answer brief."
    )

    console.log("Response received:")
    console.log(response.slice(0, 500))
    console.log(`\nResponse length: ${response.length} chars`)
    console.log("Gemini provider test PASSED")
  } catch (err) {
    console.error("Gemini provider test FAILED:", err)
  }
}
