import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { ScanOrchestrator, type ScanInput } from "@/lib/scan-v3"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { scrapeUrl as jinaScrapeUrl } from "@/lib/scan-v2/scraper"

export const dynamic = "force-dynamic"
export const maxDuration = 240

function createLlmCallAdapter(): (prompt: string) => Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return async (prompt: string) => {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0,
    })
    return res.choices[0]?.message?.content || ""
  }
}

function createQueryLlmAdapter(): (query: string, provider: "openai" | "claude") => Promise<string> {
  let openai: OpenAI | null = null
  let anthropic: Anthropic | null = null
  return async (query: string, provider: "openai" | "claude") => {
    if (provider === "openai") {
      if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: query }],
        max_tokens: 1500,
        temperature: 0,
      })
      return res.choices[0]?.message?.content || ""
    } else {
      if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const res = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        temperature: 0,
        messages: [{ role: "user", content: query }],
      })
      const textBlock = res.content.find((b) => b.type === "text")
      return textBlock?.type === "text" ? textBlock.text : ""
    }
  }
}

function createScrapeAdapter(): (url: string) => Promise<string> {
  return async (url: string) => {
    const result = await jinaScrapeUrl(url)
    return result.content || ""
  }
}

export async function GET() {
  const startTime = Date.now()
  const logs: string[] = []
  const log = (msg: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const entry = `[${elapsed}s] ${msg}`
    logs.push(entry)
    console.log(entry)
  }

  try {
    log("Starting test scan for Linear (https://linear.app)")

    const adminDb = createAdminClient()
    log("Admin client created")

    const scanInput: ScanInput = {
      brand_name: "Linear",
      website_url: "https://linear.app",
      core_problem: "Slow project trackers for software teams",
      target_buyer: "Engineering managers at startups",
      plan_tier: "free",
    }

    const scanId = `test_${Date.now()}`
    const orchestrator = new ScanOrchestrator(
      adminDb,
      createLlmCallAdapter(),
      createQueryLlmAdapter(),
      createScrapeAdapter(),
      "free"
    )
    log("Orchestrator created, starting scan...")

    const result = await orchestrator.runScan(scanId, "https://linear.app", scanInput)

    log(`Scan complete! Score: ${result.score.final_score}/100`)
    log(`Brand: ${result.profile.brand_name}`)
    log(`Category: ${result.profile.category}`)
    log(`Queries: ${result.query_count}`)
    log(`Competitors: ${result.competitors.length}`)

    return NextResponse.json({
      status: "success",
      elapsed_ms: Date.now() - startTime,
      result: {
        score: result.score.final_score,
        brand_name: result.profile.brand_name,
        category: result.profile.category,
        query_count: result.query_count,
        competitors: result.competitors.map((c) => c.competitor_name),
      },
      logs,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`FAILED: ${msg}`)

    return NextResponse.json({
      status: "error",
      elapsed_ms: Date.now() - startTime,
      error: msg,
      logs,
    }, { status: 500 })
  }
}
