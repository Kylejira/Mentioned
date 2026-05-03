import { notFound } from "next/navigation"
import { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase-admin"
import { ResultView, type PublicScanData } from "./result-view"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

const PUBLIC_SCAN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SCAN === "true"

/**
 * Loads a public scan by ID. Returns null when the scan doesn't exist OR is
 * not flagged as public (so private scans never leak through this route).
 */
async function loadPublicScan(id: string): Promise<PublicScanData | null> {
  if (!id) return null
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from("scans")
      .select(
        "id, status, stage, progress, score, score_breakdown, saas_profile, summary, query_count, is_public, created_at",
      )
      .eq("id", id)
      .maybeSingle()

    if (error || !data) return null
    if (data.is_public !== true) return null

    return {
      id: data.id as string,
      status: (data.status as string) || "queued",
      stage: (data.stage as string) || null,
      progress: (data.progress as number) || 0,
      score: (data.score as number) ?? null,
      saasProfile: (data.saas_profile as Record<string, unknown> | null) || null,
      summary: (data.summary as Record<string, unknown> | null) || null,
      queryCount: (data.query_count as number) ?? null,
      createdAt: (data.created_at as string) || null,
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const scan = await loadPublicScan(id)
  if (!scan) {
    return {
      title: "Scan not found · Mentioned",
      robots: { index: false, follow: false },
    }
  }

  const profile = scan.saasProfile || {}
  const brandName = (profile.brand_name as string) || "Brand"
  const score = scan.score ?? null
  const queryCount = scan.queryCount ?? null
  const summary = scan.summary || {}
  const legacy = (summary.legacy_result as Record<string, unknown> | null) || null
  const sources = (legacy?.sources as Record<string, unknown> | null) || null
  const chatgptMentioned = sources && typeof sources === "object"
    ? Boolean((sources as Record<string, { mentioned?: boolean }>).chatgpt?.mentioned)
    : false
  const claudeMentioned = sources && typeof sources === "object"
    ? Boolean((sources as Record<string, { mentioned?: boolean }>).claude?.mentioned)
    : false
  const mentionedCount = [chatgptMentioned, claudeMentioned].filter(Boolean).length

  let summaryLine: string
  if (scan.status !== "complete" && scan.status !== "recommended" && scan.status !== "low_visibility" && scan.status !== "not_mentioned") {
    summaryLine = "Running AI visibility check…"
  } else if (score !== null && queryCount) {
    summaryLine = `${brandName} scored ${score}/100 across ${queryCount} AI queries.`
  } else {
    summaryLine = `${brandName} AI visibility report.`
  }

  return {
    title: `${brandName} AI Visibility Report · Mentioned`,
    description: summaryLine,
    // We do NOT want thousands of thin scan pages indexed.
    robots: { index: false, follow: true },
    openGraph: {
      title: `${brandName} AI Visibility Report`,
      description: summaryLine,
      type: "article",
      siteName: "Mentioned",
    },
    twitter: {
      card: "summary_large_image",
      title: `${brandName} AI Visibility Report`,
      description: summaryLine,
    },
  }
}

export default async function PublicScanResultPage({ params }: PageProps) {
  const { id } = await params

  if (!PUBLIC_SCAN_ENABLED) {
    notFound()
  }

  const scan = await loadPublicScan(id)
  if (!scan) {
    notFound()
  }

  return <ResultView initialScan={scan} scanId={id} />
}
