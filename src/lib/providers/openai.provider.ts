import OpenAI from "openai"
import type { AIProvider } from "./provider.types"

export interface OpenAIProviderConfig {
  model?: string
  maxTokens?: number
  temperature?: number
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai"
  private client: OpenAI
  private model: string
  private maxTokens: number
  private temperature: number

  constructor(config: OpenAIProviderConfig = {}) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    this.model = config.model ?? "gpt-4o"
    this.maxTokens = config.maxTokens ?? 1500
    this.temperature = config.temperature ?? 0.3
  }

  async generateResponse(prompt: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    })
    return res.choices[0]?.message?.content || ""
  }
}
