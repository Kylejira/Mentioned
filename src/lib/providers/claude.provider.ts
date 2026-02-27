import Anthropic from "@anthropic-ai/sdk"
import type { AIProvider } from "./provider.types"

export interface ClaudeProviderConfig {
  model?: string
  maxTokens?: number
  temperature?: number
}

export class ClaudeProvider implements AIProvider {
  readonly name = "claude"
  private client: Anthropic
  private model: string
  private maxTokens: number
  private temperature: number

  constructor(config: ClaudeProviderConfig = {}) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    this.model = config.model ?? "claude-3-haiku-20240307"
    this.maxTokens = config.maxTokens ?? 1500
    this.temperature = config.temperature ?? 0.3
  }

  async generateResponse(prompt: string): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [{ role: "user", content: prompt }],
    })
    const textBlock = res.content.find((b) => b.type === "text")
    return textBlock?.type === "text" ? textBlock.text : ""
  }
}
