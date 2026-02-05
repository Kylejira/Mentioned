import { NextResponse } from "next/server"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    openai: { configured: false, working: false, error: null },
    anthropic: { configured: false, working: false, error: null }
  }

  // Test OpenAI
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    results.openai = {
      configured: true,
      keyPrefix: openaiKey.substring(0, 8),
      working: false,
      error: null
    }
    
    try {
      const client = new OpenAI({ apiKey: openaiKey })
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say 'OpenAI working' in exactly 2 words" }],
        max_tokens: 10
      })
      
      const content = response.choices[0]?.message?.content
      results.openai = {
        ...results.openai as object,
        working: !!content,
        response: content?.substring(0, 50)
      }
    } catch (error) {
      results.openai = {
        ...results.openai as object,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // Test Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    results.anthropic = {
      configured: true,
      keyPrefix: anthropicKey.substring(0, 8),
      working: false,
      error: null
    }
    
    try {
      const client = new Anthropic({ apiKey: anthropicKey })
      const response = await client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say 'Claude working' in exactly 2 words" }]
      })
      
      const textBlock = response.content.find(block => block.type === "text")
      const content = textBlock?.type === "text" ? textBlock.text : null
      
      results.anthropic = {
        ...results.anthropic as object,
        working: !!content,
        response: content?.substring(0, 50)
      }
    } catch (error) {
      results.anthropic = {
        ...results.anthropic as object,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  return NextResponse.json(results)
}
