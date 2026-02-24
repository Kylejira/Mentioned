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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brand = searchParams.get("brand") || "Lemon Squeezy"
  const url = searchParams.get("url") || "https://lemonsqueezy.com"

  const startTime = Date.now()
  const logs: string[] = []
  const log = (msg: string) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const entry = `[${elapsed}s] ${msg}`
    logs.push(entry)
    console.log(entry)
  }

  const origLog = console.log
  const origError = console.error
  const origWarn = console.warn
  console.log = (...args: unknown[]) => {
    const msg = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")
    logs.push(msg)
    origLog.apply(console, args)
  }
  console.error = (...args: unknown[]) => {
    const msg = "[ERROR] " + args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")
    logs.push(msg)
    origError.apply(console, args)
  }
  console.warn = (...args: unknown[]) => {
    const msg = "[WARN] " + args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ")
    logs.push(msg)
    origWarn.apply(console, args)
  }
  const restoreConsole = () => {
    console.log = origLog
    console.error = origError
    console.warn = origWarn
  }

  try {
    log(`Starting test scan for ${brand} (${url})`)
    log(`API keys present: openai=${!!process.env.OPENAI_API_KEY} anthropic=${!!process.env.ANTHROPIC_API_KEY}`)
    log(`SCAN_VERSION: ${process.env.SCAN_VERSION || "not set"}`)

    const adminDb = createAdminClient()
    log("Admin client created")

    const scanInput: ScanInput = {
      brand_name: brand,
      website_url: url,
      core_problem: "",
      target_buyer: "",
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

    const result = await orchestrator.runScan(scanId, url, scanInput)

    log(`Scan complete! Score: ${result.score.final_score}/100`)
    log(`Brand: ${result.profile.brand_name}`)
    log(`Category: ${result.profile.category}`)
    log(`Queries: ${result.query_count}`)
    log(`Competitors: ${result.competitors.length}`)
    log(`Mention rate: ${result.score.mention_rate}`)

    restoreConsole()
    return NextResponse.json({
      status: "success",
      elapsed_ms: Date.now() - startTime,
      result: {
        score: result.score.final_score,
        mention_rate: result.score.mention_rate,
        brand_name: result.profile.brand_name,
        brand_aliases: result.profile.brand_aliases,
        category: result.profile.category,
        query_count: result.query_count,
        competitors: result.competitors.map((c) => c.competitor_name),
        score_breakdown: result.score,
      },
      logs,
    })
  } catch (err) {
    restoreConsole()
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 5).join(" | ") : ""
    logs.push(`FAILED: ${msg}`)
    logs.push(`Stack: ${stack}`)

    return NextResponse.json({
      status: "error",
      elapsed_ms: Date.now() - startTime,
      error: msg,
      logs,
    }, { status: 500 })
  }
}
