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
    this.model = config.model ?? "gpt-5.4-mini"
    this.maxTokens = config.maxTokens ?? 1500
    this.temperature = config.temperature ?? 0.3
  }

  private usesMaxCompletionTokens(): boolean {
    return /^(gpt-5|o[1-4])/.test(this.model)
  }

  async generateResponse(prompt: string): Promise<string> {
    const tokenParam = this.usesMaxCompletionTokens()
      ? { max_completion_tokens: this.maxTokens }
      : { max_tokens: this.maxTokens }

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      ...tokenParam,
      temperature: this.temperature,
    })
    return res.choices[0]?.message?.content || ""
  }
}
