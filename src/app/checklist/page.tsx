"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useSubscription } from "@/lib/subscription"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { 
  Globe,
  LayoutGrid,
  Award,
  FileText,
  Code,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  Layers,
  Check,
  Lock
} from "lucide-react"
import { cn } from "@/lib/utils"

// Priority types and colors
type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

const PRIORITY_STYLES: Record<Priority, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-gray-100 text-gray-600",
}

// Checklist item definition
interface ChecklistItem {
  id: string
  title: string
  priority: Priority
  timeEstimate: string
  description: string
  steps: string[]
  proTip?: string
}

interface ChecklistSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  items: ChecklistItem[]
}

// Define all checklist sections and items
const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: "foundation",
    title: "Foundation",
    description: "Get discovered by AI systems",
    icon: <Globe className="size-5" />,
    items: [
      {
        id: "bing-webmaster",
        title: "Register with Bing Webmaster Tools",
        priority: "CRITICAL",
        timeEstimate: "10 mins",
        description: "Bing powers many AI tools including Microsoft Copilot, ChatGPT's web browsing, and Perplexity. Getting indexed by Bing is essential for AI visibility.",
        steps: [
          "Go to bing.com/webmasters and sign in with Microsoft account",
          "Add your website URL",
          "Verify ownership via DNS, file upload, or meta tag",
          "Submit your sitemap.xml",
          "Wait 24-48 hours for initial indexing"
        ],
        proTip: "Submit your sitemap immediately after verification to speed up indexing of all your pages."
      },
      {
        id: "google-search-console",
        title: "Set up Google Search Console",
        priority: "HIGH",
        timeEstimate: "10 mins",
        description: "Google's index feeds into Gemini and many other AI tools. Ensuring proper indexing here helps AI systems understand and recommend your content.",
        steps: [
          "Go to search.google.com/search-console",
          "Add your property (URL prefix or domain)",
          "Verify ownership",
          "Submit your sitemap",
          "Check for any crawl errors"
        ],
        proTip: "Use the URL Inspection tool to check if specific pages are indexed correctly."
      },
      {
        id: "openai-submission",
        title: "Submit your brand to OpenAI",
        priority: "HIGH",
        timeEstimate: "15 mins",
        description: "OpenAI's ChatGPT is the most popular AI assistant. Ensuring they can crawl your site and know about your brand increases your chances of being recommended.",
        steps: [
          "Check your robots.txt allows GPTBot",
          "Ensure your site is publicly accessible",
          "Create clear, informative content about your product",
          "Build authoritative backlinks",
          "Get mentioned on trusted sources"
        ],
        proTip: "Add 'User-agent: GPTBot Allow: /' to your robots.txt to explicitly allow OpenAI's crawler."
      },
      {
        id: "crawl-accessibility",
        title: "Remove crawler blockers",
        priority: "CRITICAL",
        timeEstimate: "20 mins",
        description: "Many sites accidentally block AI crawlers. Review your technical setup to ensure AI systems can access your content.",
        steps: [
          "Review robots.txt for overly restrictive rules",
          "Check for bot-blocking in server configuration",
          "Ensure JavaScript content is crawlable",
          "Test with Google's Mobile-Friendly Test",
          "Verify pages load without authentication requirements"
        ],
        proTip: "Use 'curl -A \"GPTBot\" yoursite.com' to test if your site responds to AI crawlers."
      }
    ]
  },
  {
    id: "site-structure",
    title: "Site Structure",
    description: "Make your content easy to understand",
    icon: <LayoutGrid className="size-5" />,
    items: [
      {
        id: "clean-titles",
        title: "Optimize page titles and headings",
        priority: "HIGH",
        timeEstimate: "1-2 hours",
        description: "Clear, descriptive titles help AI understand what each page is about. Use natural language that matches how people ask questions.",
        steps: [
          "Audit all page titles for clarity",
          "Include primary keyword/topic in H1",
          "Use descriptive H2s for main sections",
          "Match titles to common user questions",
          "Keep titles under 60 characters"
        ],
        proTip: "Think about how someone would ask an AI about your topic, then structure your titles to match."
      },
      {
        id: "clear-descriptions",
        title: "Write clear meta descriptions",
        priority: "MEDIUM",
        timeEstimate: "1-2 hours",
        description: "Meta descriptions are often used by AI to understand page content. Well-written descriptions can influence how AI presents your information.",
        steps: [
          "Write unique descriptions for each page",
          "Include your brand name naturally",
          "Summarize the page's value proposition",
          "Keep under 160 characters",
          "Include relevant keywords naturally"
        ],
        proTip: "Write descriptions as if answering 'What is this page about?' in one sentence."
      },
      {
        id: "category-structure",
        title: "Create clear content categories",
        priority: "MEDIUM",
        timeEstimate: "2-3 hours",
        description: "Well-organized content helps AI understand your expertise areas. Clear categories signal topical authority.",
        steps: [
          "Define 3-5 main content categories",
          "Create dedicated category/hub pages",
          "Interlink related content within categories",
          "Use consistent naming conventions",
          "Build topic clusters around main themes"
        ],
        proTip: "Create a 'pillar page' for each main topic that links to all related content."
      }
    ]
  },
  {
    id: "build-authority",
    title: "Build Authority",
    description: "Get mentioned on trusted sources",
    icon: <Award className="size-5" />,
    items: [
      {
        id: "reddit-quora",
        title: "Engage on Reddit and Quora",
        priority: "HIGH",
        timeEstimate: "Ongoing",
        description: "AI models are heavily trained on Reddit and Quora discussions. Genuine, helpful participation builds brand visibility in AI training data.",
        steps: [
          "Find relevant subreddits in your niche",
          "Answer questions authentically (no spam)",
          "Share genuine insights and experiences",
          "Build karma before mentioning your brand",
          "Create valuable Quora answers with depth"
        ],
        proTip: "Focus on being genuinely helpful. Overly promotional content gets downvoted and ignored."
      },
      {
        id: "review-platforms",
        title: "Get listed on review platforms",
        priority: "CRITICAL",
        timeEstimate: "1-2 hours",
        description: "G2, Capterra, and TrustRadius are heavily referenced by AI when recommending software. Having reviews here significantly boosts visibility.",
        steps: [
          "Create profiles on G2, Capterra, TrustRadius",
          "Complete all profile information",
          "Ask customers for reviews",
          "Respond to existing reviews",
          "Keep information up-to-date"
        ],
        proTip: "Ask your happiest customers for reviews right after a positive interaction or milestone."
      },
      {
        id: "press-coverage",
        title: "Get press coverage",
        priority: "MEDIUM",
        timeEstimate: "Ongoing",
        description: "News articles and press mentions from authoritative sources are trusted signals for AI systems. They help establish credibility and expertise.",
        steps: [
          "Create a newsworthy angle for your story",
          "Build relationships with relevant journalists",
          "Use HARO (Help a Reporter Out)",
          "Issue press releases for major updates",
          "Get featured in industry publications"
        ],
        proTip: "Focus on trade publications in your industry first - they're often easier to get into."
      },
      {
        id: "wikipedia",
        title: "Work toward Wikipedia presence",
        priority: "LOW",
        timeEstimate: "Long-term",
        description: "Wikipedia is a primary knowledge source for AI. Having a page (if notable enough) dramatically increases AI visibility and credibility.",
        steps: [
          "Check Wikipedia's notability guidelines",
          "Gather third-party reliable sources",
          "Don't create your own article (conflict of interest)",
          "Consider hiring a Wikipedia consultant",
          "Focus on building notability first"
        ],
        proTip: "You need significant third-party coverage before Wikipedia will consider you notable."
      }
    ]
  },
  {
    id: "content-optimization",
    title: "Content Optimization",
    description: "Create AI-friendly content",
    icon: <FileText className="size-5" />,
    items: [
      {
        id: "natural-language",
        title: "Use natural, conversational language",
        priority: "HIGH",
        timeEstimate: "Ongoing",
        description: "AI models prefer content that sounds natural and helpful. Write as if explaining to a friend, not as keyword-stuffed SEO content.",
        steps: [
          "Audit existing content for readability",
          "Replace jargon with plain language",
          "Use question-and-answer formats",
          "Write in active voice",
          "Include examples and explanations"
        ],
        proTip: "Read your content aloud - if it sounds awkward, it probably reads awkward to AI too."
      },
      {
        id: "comparison-content",
        title: "Create comparison content",
        priority: "CRITICAL",
        timeEstimate: "3-4 hours per page",
        description: "'X vs Y' searches are common in AI. Having comparison pages helps you get mentioned when users ask about alternatives or comparisons.",
        steps: [
          "Identify your top 3-5 competitors",
          "Create dedicated comparison pages",
          "Be fair and honest in comparisons",
          "Include feature comparison tables",
          "Update regularly as products change"
        ],
        proTip: "Create pages for 'YourProduct vs [Competitor]' - AI often cites these directly."
      },
      {
        id: "podcasts-youtube",
        title: "Appear on podcasts and YouTube",
        priority: "MEDIUM",
        timeEstimate: "Ongoing",
        description: "Transcripts from audio and video content become AI training data. Being featured on popular shows expands your brand's presence in AI knowledge.",
        steps: [
          "Identify relevant podcasts in your niche",
          "Pitch yourself as a guest expert",
          "Create shareable insights for hosts",
          "Ensure show notes include your brand",
          "Cross-promote appearances on your channels"
        ],
        proTip: "Start with smaller podcasts to build experience, then pitch to larger ones."
      }
    ]
  },
  {
    id: "technical",
    title: "Technical SEO",
    description: "Optimize for AI crawlers",
    icon: <Code className="size-5" />,
    items: [
      {
        id: "image-optimization",
        title: "Optimize images with alt text",
        priority: "MEDIUM",
        timeEstimate: "1-2 hours",
        description: "Descriptive alt text helps AI understand visual content. This is especially important as AI becomes more multimodal.",
        steps: [
          "Audit all images for missing alt text",
          "Write descriptive, contextual alt text",
          "Include relevant keywords naturally",
          "Describe what's actually in the image",
          "Keep alt text under 125 characters"
        ],
        proTip: "Good alt text describes the image as if explaining it to someone who can't see it."
      },
      {
        id: "schema-markup",
        title: "Implement schema markup",
        priority: "HIGH",
        timeEstimate: "2-3 hours",
        description: "Structured data helps AI understand your content's context and relationships. It's like giving AI a cheat sheet about your pages.",
        steps: [
          "Add Organization schema to homepage",
          "Implement Product schema for products",
          "Use FAQ schema for Q&A content",
          "Add Article schema to blog posts",
          "Test with Google's Rich Results Test"
        ],
        proTip: "Start with Organization and FAQ schema - they provide the most visibility benefit."
      }
    ]
  }
]

// Get total items count
const TOTAL_ITEMS = CHECKLIST_SECTIONS.reduce((sum, section) => sum + section.items.length, 0)

// Progress ring color based on completion percentage
function getProgressColor(percent: number): string {
  if (percent >= 90) return "#2563EB"
  if (percent >= 60) return "#10B981"
  if (percent >= 30) return "#F7B500"
  return "#E74444"
}

// Progress Ring Component
function ProgressRing({ percent, size = 100 }: { percent: number; size?: number }) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percent / 100) * circumference
  const color = getProgressColor(percent)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeWidth}
        />
        {/* Visible track ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.4)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-white">{percent}%</span>
      </div>
    </div>
  )
}

// Priority Badge Component
function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span 
      className={cn(
        "text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full",
        PRIORITY_STYLES[priority]
      )}
    >
      {priority}
    </span>
  )
}

// Checklist Item Component
function ChecklistItemCard({ 
  item, 
  isCompleted, 
  onToggle 
}: { 
  item: ChecklistItem
  isCompleted: boolean
  onToggle: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div 
      className={cn(
        "bg-white rounded-xl border transition-all duration-200",
        isExpanded ? "shadow-lg border-gray-200" : "border-gray-100 hover:shadow-md hover:border-l-2 hover:border-l-blue-500"
      )}
    >
      {/* Item Header */}
      <div 
        className="flex items-center gap-4 py-4 px-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200",
            isCompleted
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 hover:border-blue-500"
          )}
        >
          {isCompleted && <Check className="size-3" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className={cn(
              "text-sm font-medium",
              isCompleted ? "text-gray-400 line-through" : "text-gray-900"
            )}>
              {item.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <PriorityBadge priority={item.priority} />
            <span className="text-gray-300">·</span>
            <div className="flex items-center gap-1 text-gray-500 text-xs">
              <Clock className="size-3" />
              <span>{item.timeEstimate}</span>
            </div>
          </div>
        </div>

        {/* Expand Icon */}
        <div className="text-gray-400">
          {isExpanded ? (
            <ChevronDown className="size-5" />
          ) : (
            <ChevronRight className="size-5" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          {/* Description */}
          <p className="text-[#64748B] text-sm mt-4 leading-relaxed">
            {item.description}
          </p>

          {/* Steps */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-[#1E293B] mb-3">Steps to Complete</h4>
            <ol className="space-y-2">
              {item.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="size-5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-sm text-[#64748B]">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Pro Tip */}
          {item.proTip && (
            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
              <div className="flex items-start gap-2">
                <span className="text-base">💡</span>
                <p className="text-sm text-[#4338CA] leading-relaxed">
                  <span className="font-semibold">Pro tip:</span> {item.proTip}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChecklistPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const subscription = useSubscription()
  const [completedItems, setCompletedItems] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(
    CHECKLIST_SECTIONS.map(s => s.id) // All expanded by default
  )

  // Redirect free users or show upgrade modal
  useEffect(() => {
    if (!subscription.isLoading && subscription.plan === "free") {
      setShowUpgradeModal(true)
    }
  }, [subscription.isLoading, subscription.plan])

  // Fetch checklist on mount
  useEffect(() => {
    const fetchChecklist = async () => {
      try {
        const response = await fetch('/api/checklist')
        if (response.ok) {
          const data = await response.json()
          setCompletedItems(data.completed_items || [])
        } else if (response.status === 401) {
          setCompletedItems([])
        }
      } catch (error) {
        console.error('Error fetching checklist:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChecklist()
  }, [])

  // Save checklist to server
  const saveChecklist = useCallback(async (items: string[]) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_items: items })
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }
    } catch (error) {
      console.error('Error saving checklist:', error)
      showToast('Failed to save progress. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [showToast])

  // Toggle item completion
  const toggleItem = useCallback((itemId: string) => {
    setCompletedItems(prev => {
      const newItems = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
      
      saveChecklist(newItems)
      return newItems
    })
  }, [saveChecklist])

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  // Calculate progress
  const completedCount = completedItems.length
  const progressPercent = Math.round((completedCount / TOTAL_ITEMS) * 100)

  // Get section progress
  const getSectionProgress = (section: ChecklistSection) => {
    const completed = section.items.filter(item => completedItems.includes(item.id)).length
    return { completed, total: section.items.length }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-12">
        {/* Dark Gradient Header */}
        <div 
          className="rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1E293B 0%, #334155 100%)"
          }}
        >
          {/* Blue accent gradient */}
          <div 
            className="absolute top-0 right-0 w-64 h-64 opacity-30"
            style={{
              background: "radial-gradient(circle at top right, #3B82F6 0%, transparent 70%)"
            }}
          />

          <div className="relative flex items-center justify-between gap-6">
            <div className="flex-1">
              {/* Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm mb-4">
                <Layers className="size-4 text-white/80" />
                <span className="text-sm font-medium text-white/90">AI Visibility Checklist</span>
              </div>

              {/* Heading */}
              <h1 className="text-2xl md:text-[28px] font-bold text-white mb-2">
                Get Recommended by AI
              </h1>
              <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-md">
                Complete this checklist to optimize your brand for AI recommendations. Work through each section to improve your visibility on ChatGPT, Claude, and other AI tools.
              </p>
            </div>

            {/* Progress Ring */}
            <div className="shrink-0 text-center">
              <ProgressRing percent={progressPercent} size={100} />
              <p className="text-white/70 text-sm mt-2">
                {completedCount} of {TOTAL_ITEMS} complete
              </p>
            </div>
          </div>

          {/* Saving indicator */}
          {isSaving && (
            <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-white/60">
              <Loader2 className="size-3 animate-spin" />
              Saving...
            </div>
          )}
        </div>

        {/* Checklist Sections */}
        <div className="space-y-10">
          {CHECKLIST_SECTIONS.map(section => {
            const isExpanded = expandedSections.includes(section.id)
            const { completed, total } = getSectionProgress(section)

            return (
              <div key={section.id}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between py-3 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-gray-200 transition-colors">
                      {section.icon}
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
                      <p className="text-sm text-gray-500">{section.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-sm font-semibold px-2.5 py-1 rounded-full",
                      completed === total 
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    )}>
                      {completed}/{total}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="size-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="size-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Section Items */}
                <div className={cn(
                  "overflow-hidden transition-all duration-300",
                  isExpanded ? "max-h-[2000px] opacity-100 mt-3" : "max-h-0 opacity-0"
                )}>
                  <div className="space-y-3">
                    {section.items.map(item => (
                      <ChecklistItemCard
                        key={item.id}
                        item={item}
                        isCompleted={completedItems.includes(item.id)}
                        onToggle={() => toggleItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 bg-white rounded-2xl border border-gray-200 py-8 px-6 text-center shadow-sm">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Ready to track your progress?
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Run a new scan to see how your visibility has improved after completing checklist items.
          </p>
          <Link href="/check">
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm"
            >
              Run New Scan
            </Button>
          </Link>
        </div>
      </div>

      {/* Upgrade Modal for Free Users */}
      {showUpgradeModal && (
        <UpgradePrompt
          feature="checklist"
          onClose={() => {
            setShowUpgradeModal(false)
            router.push("/dashboard")
          }}
        />
      )}
    </AppShell>
  )
}
