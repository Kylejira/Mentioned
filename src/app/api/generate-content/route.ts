import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import {
  generateContent,
  type ContentType,
} from "@/lib/scan-v3/generation/visibility-fix-generator"
import { log } from "@/lib/logger"

const logger = log.create("generate-content-api")

export const maxDuration = 120
export const dynamic = "force-dynamic"

const PRO_WHITELIST = (process.env.PRO_WHITELIST_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const VALID_TYPES: ContentType[] = ["comparison", "answer_page", "faq", "positioning"]

interface GenerateRequest {
  scanId: string
  type: ContentType
  opportunityData: Record<string, unknown>
  regenerate?: boolean
}

// ---------------------------------------------------------------------------
// POST /api/generate-content
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth check ──
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // ── 2. Plan gating — free users cannot generate content ──
    const isWhitelisted = PRO_WHITELIST.includes(user.email?.toLowerCase() || "")
    let isPaid = isWhitelisted

    if (!isPaid) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single()

      isPaid = !!subscription?.plan
    }

    if (!isPaid) {
      return NextResponse.json(
        {
          error: "Content generation requires a paid plan",
          code: "PLAN_REQUIRED",
        },
        { status: 403 }
      )
    }

    // ── 3. Parse and validate body ──
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key required" }, { status: 500 })
    }

    let body: GenerateRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { scanId, type, opportunityData, regenerate } = body

    if (!scanId || !type || !opportunityData) {
      return NextResponse.json(
        { error: "Missing required fields: scanId, type, opportunityData" },
        { status: 400 }
      )
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      )
    }

    const adminDb = createAdminClient()

    // ── 4. Verify scan belongs to this user ──
    const { data: scan, error: scanError } = await adminDb
      .from("scans")
      .select("id, brand_id, summary, score")
      .eq("id", scanId)
      .single()

    if (scanError || !scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    if (scan.brand_id) {
      const { data: brand } = await adminDb
        .from("brands")
        .select("user_id")
        .eq("id", scan.brand_id)
        .single()

      if (brand && brand.user_id !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    // ── 5. Cache check — return existing content if already generated ──
    const cacheKey = buildCacheKey(type, opportunityData)

    if (regenerate) {
      // Delete old content for this cache key so we generate fresh
      const { data: oldRows } = await adminDb
        .from("generated_content")
        .select("id, metadata")
        .eq("user_id", user.id)
        .eq("scan_id", scanId)
        .eq("type", type)

      if (oldRows && oldRows.length > 0) {
        const toDelete = oldRows
          .filter((row) => {
            const meta = row.metadata as Record<string, unknown> | null
            return meta?.cache_key === cacheKey
          })
          .map((row) => row.id)

        if (toDelete.length > 0) {
          await adminDb
            .from("generated_content")
            .delete()
            .in("id", toDelete)

          logger.info("Deleted old content for regeneration", {
            count: toDelete.length,
            type,
            scanId,
          })
        }
      }
    } else {
      const { data: existing } = await adminDb
        .from("generated_content")
        .select("id, title, body, metadata, status, created_at")
        .eq("user_id", user.id)
        .eq("scan_id", scanId)
        .eq("type", type)
        .eq("status", "generated")
        .order("created_at", { ascending: false })
        .limit(10)

      if (existing && existing.length > 0) {
        const cached = existing.find((row) => {
          const meta = row.metadata as Record<string, unknown> | null
          return meta?.cache_key === cacheKey
        })

        if (cached) {
          logger.info("Cache hit — returning existing content", {
            contentId: cached.id,
            type,
            scanId,
          })
          return NextResponse.json({
            success: true,
            content: {
              id: cached.id,
              title: cached.title,
              body: cached.body,
              metadata: cached.metadata,
            },
            cached: true,
          })
        }
      }
    }

    // ── 6. Insert placeholder row with "generating" status ──
    const { data: placeholder, error: insertError } = await adminDb
      .from("generated_content")
      .insert({
        user_id: user.id,
        scan_id: scanId,
        type,
        title: "Generating...",
        body: "",
        status: "generating",
        metadata: { cache_key: cacheKey },
      })
      .select("id")
      .single()

    if (insertError || !placeholder) {
      logger.error("Failed to insert placeholder", { error: insertError?.message })
      return NextResponse.json({ error: "Failed to start generation" }, { status: 500 })
    }

    const contentId = placeholder.id

    // ── 7. Load profile from scan's saas_profile or brand ──
    const profile = await loadProfile(adminDb, scan)
    const summary = (scan.summary as Record<string, unknown>) || {}

    // ── 8. Generate content ──
    logger.info("Generating content", { contentId, type, scanId })

    let result
    try {
      result = await generateContent(type, opportunityData, profile, summary)
    } catch (genError) {
      logger.error("Generation failed", {
        contentId,
        error: genError instanceof Error ? genError.message : String(genError),
      })

      await adminDb
        .from("generated_content")
        .update({
          status: "failed",
          body: genError instanceof Error ? genError.message : "Generation failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", contentId)

      return NextResponse.json({ error: "Content generation failed" }, { status: 500 })
    }

    // ── 9. Persist to generated_content table ──
    const { error: updateError } = await adminDb
      .from("generated_content")
      .update({
        title: result.title,
        body: result.body,
        status: "generated",
        metadata: {
          ...result.metadata,
          cache_key: cacheKey,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", contentId)

    if (updateError) {
      logger.error("Failed to persist content", { contentId, error: updateError.message })
    }

    logger.info("Content generated successfully", { contentId, type, scanId })

    return NextResponse.json({
      success: true,
      content: {
        id: contentId,
        title: result.title,
        body: result.body,
        metadata: result.metadata,
      },
      cached: false,
    })
  } catch (error) {
    logger.error("Content generation error", { error: String(error) })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET /api/generate-content?scanId=xxx — list all generated content for a scan
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scanId = request.nextUrl.searchParams.get("scanId")
    if (!scanId) {
      return NextResponse.json({ error: "Missing scanId parameter" }, { status: 400 })
    }

    const { data: content, error } = await supabase
      .from("generated_content")
      .select("id, type, title, body, metadata, status, created_at")
      .eq("user_id", user.id)
      .eq("scan_id", scanId)
      .eq("status", "generated")
      .order("created_at", { ascending: false })

    if (error) {
      logger.error("Failed to fetch generated content", { error: error.message })
      return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 })
    }

    return NextResponse.json({ content: content || [] })
  } catch (error) {
    logger.error("Fetch generated content error", { error: String(error) })
    return NextResponse.json({ error: "Unknown error" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCacheKey(type: string, data: Record<string, unknown>): string {
  const keyParts: string[] = [type]

  switch (type) {
    case "comparison":
      keyParts.push(String(data.competitor_name || ""))
      break
    case "answer_page":
      keyParts.push(String(data.query_text || "").slice(0, 80))
      break
    case "faq":
      keyParts.push(String((data.missed_queries as string[])?.length || 0))
      break
    case "positioning":
      keyParts.push(String((data.gaps as string[])?.length || 0))
      break
  }

  return keyParts.join(":").toLowerCase().replace(/\s+/g, "_")
}

async function loadProfile(
  adminDb: ReturnType<typeof createAdminClient>,
  scan: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (scan.saas_profile && typeof scan.saas_profile === "object") {
    return scan.saas_profile as Record<string, unknown>
  }

  if (scan.brand_id) {
    const { data: brand } = await adminDb
      .from("brands")
      .select("name, url, category, description")
      .eq("id", scan.brand_id as string)
      .single()

    if (brand) {
      return {
        brand_name: brand.name || "",
        category: brand.category || "",
        domain: brand.url || "",
        core_problem: brand.description || "",
        key_differentiators: [],
        target_audience: "",
        target_buyer: "",
        user_differentiators: "",
      }
    }
  }

  const summary = (scan.summary as Record<string, unknown>) || {}
  return {
    brand_name: (summary.brand_name as string) || "Your Product",
    category: (summary.category as string) || "",
    key_differentiators: [],
    target_audience: "",
    target_buyer: "",
    user_differentiators: "",
    core_problem: "",
    domain: "",
  }
}
