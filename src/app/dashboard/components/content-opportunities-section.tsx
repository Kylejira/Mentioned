'use client'

import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  ArrowRight,
  FileText,
  GitCompare,
  HelpCircle,
  Target,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentOpportunitiesData {
  comparison_pages: unknown[]
  answer_pages: unknown[]
  faq_sets: unknown[]
  positioning_briefs: unknown[]
  total_opportunities: number
  computed_at: string
}

interface ContentOpportunitiesSectionProps {
  data: ContentOpportunitiesData | null
  score: number
}

// ---------------------------------------------------------------------------
// Type config (icons + colors)
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
  comparison: {
    label: "Comparison Page",
    icon: <GitCompare className="size-3.5" />,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  answer_page: {
    label: "Answer Page",
    icon: <FileText className="size-3.5" />,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  faq: {
    label: "FAQ Set",
    icon: <HelpCircle className="size-3.5" />,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  positioning: {
    label: "Positioning Brief",
    icon: <Target className="size-3.5" />,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
}

// ---------------------------------------------------------------------------
// Compact summary card (dashboard inline)
// ---------------------------------------------------------------------------

export function ContentOpportunitiesSection({ data, score }: ContentOpportunitiesSectionProps) {
  if (!data || data.total_opportunities === 0) return null

  const isHighScore = score >= 75

  const groupCounts: Record<string, number> = {
    comparison: data.comparison_pages.length,
    answer_page: data.answer_pages.length,
    faq: data.faq_sets.length,
    positioning: data.positioning_briefs.length,
  }

  const highPriorityCount = [
    ...data.comparison_pages,
    ...data.answer_pages,
    ...data.faq_sets,
    ...data.positioning_briefs,
  ].filter((o: any) => o.priority >= 70).length

  const sectionTitle = isHighScore ? "Strengthen Your AI Position" : "Fix Your AI Visibility"

  return (
    <section>
      <Link href="/dashboard/content-opportunities" className="block group">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-5 text-blue-500 shrink-0" />
                <h2 className="text-lg font-bold text-gray-900">{sectionTitle}</h2>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                {isHighScore
                  ? "Content to maintain and extend your AI visibility lead."
                  : "We found content you can create to improve how AI recommends your product."}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{data.total_opportunities}</div>
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Opportunities</div>
                </div>
                {highPriorityCount > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-red-600">{highPriorityCount}</div>
                    <div className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">High Priority</div>
                  </div>
                )}
              </div>

              {/* Type chips */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(groupCounts)
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => {
                    const config = TYPE_CONFIG[type]
                    return (
                      <span
                        key={type}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                          config.bgColor,
                          config.borderColor,
                          config.color
                        )}
                      >
                        {config.icon}
                        {count} {config.label}{count !== 1 ? "s" : ""}
                      </span>
                    )
                  })}
              </div>
            </div>

            {/* CTA arrow */}
            <div className="shrink-0 flex items-center">
              <div className="bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 group-hover:bg-blue-700 transition shadow-sm">
                View & Generate
                <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </section>
  )
}
