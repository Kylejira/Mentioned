"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { 
  ArrowLeft,
  Check,
  Circle,
  Globe,
  Search,
  Bot,
  FileText,
  Layout,
  MessageSquare,
  Star,
  Newspaper,
  BookOpen,
  Mic,
  Image,
  Code,
  Loader2,
  Trophy,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"

// Checklist item definition
interface ChecklistItem {
  id: string
  title: string
  description: string
  link?: string
  linkText?: string
  icon: React.ReactNode
}

interface ChecklistSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  items: ChecklistItem[]
}

// Define all checklist sections and items
const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: "foundation",
    title: "Foundation",
    description: "Essential steps to get discovered by AI",
    icon: <Globe className="size-5" />,
    color: "blue",
    items: [
      {
        id: "bing-webmaster",
        title: "Submit to Bing Webmaster Tools",
        description: "Bing powers many AI tools including Copilot. Submit your site to get indexed.",
        link: "https://www.bing.com/webmasters",
        linkText: "Go to Bing Webmaster Tools",
        icon: <Search className="size-4" />
      },
      {
        id: "google-search-console",
        title: "Verify in Google Search Console",
        description: "Ensure Google can crawl your site. Gemini and other AI tools use Google's index.",
        link: "https://search.google.com/search-console",
        linkText: "Go to Search Console",
        icon: <Search className="size-4" />
      },
      {
        id: "openai-submission",
        title: "Allow OpenAI crawling",
        description: "Make sure your robots.txt allows GPTBot. Don't block AI crawlers.",
        link: "https://platform.openai.com/docs/gptbot",
        linkText: "Learn about GPTBot",
        icon: <Bot className="size-4" />
      },
      {
        id: "crawl-accessibility",
        title: "Check crawl accessibility",
        description: "Ensure your key pages are accessible without JavaScript and load quickly.",
        icon: <FileText className="size-4" />
      }
    ]
  },
  {
    id: "site-structure",
    title: "Site Structure",
    description: "Make your site easy for AI to understand",
    icon: <Layout className="size-5" />,
    color: "purple",
    items: [
      {
        id: "clean-titles",
        title: "Use clean, descriptive page titles",
        description: "Each page should have a unique title that clearly describes its content.",
        icon: <FileText className="size-4" />
      },
      {
        id: "clear-descriptions",
        title: "Write clear meta descriptions",
        description: "Meta descriptions help AI understand what each page is about.",
        icon: <FileText className="size-4" />
      },
      {
        id: "category-structure",
        title: "Organize content by category",
        description: "Use clear categories and subcategories to structure your content hierarchy.",
        icon: <Layout className="size-4" />
      }
    ]
  },
  {
    id: "build-authority",
    title: "Build Authority",
    description: "Get mentioned on trusted sources",
    icon: <Star className="size-5" />,
    color: "amber",
    items: [
      {
        id: "reddit-quora",
        title: "Engage on Reddit and Quora",
        description: "Answer questions about your industry. AI tools learn from these discussions.",
        link: "https://www.reddit.com",
        linkText: "Go to Reddit",
        icon: <MessageSquare className="size-4" />
      },
      {
        id: "review-platforms",
        title: "Get listed on review platforms",
        description: "G2, Capterra, TrustRadius — these are heavily referenced by AI tools.",
        link: "https://www.g2.com",
        linkText: "Go to G2",
        icon: <Star className="size-4" />
      },
      {
        id: "press-coverage",
        title: "Get press coverage",
        description: "News articles and press releases are trusted sources for AI training data.",
        icon: <Newspaper className="size-4" />
      },
      {
        id: "wikipedia",
        title: "Create Wikipedia presence",
        description: "If notable enough, a Wikipedia page significantly boosts AI visibility.",
        link: "https://www.wikipedia.org",
        linkText: "Learn about Wikipedia",
        icon: <BookOpen className="size-4" />
      }
    ]
  },
  {
    id: "content-optimization",
    title: "Content Optimization",
    description: "Create content AI loves to reference",
    icon: <FileText className="size-5" />,
    color: "emerald",
    items: [
      {
        id: "natural-language",
        title: "Use natural language content",
        description: "Write like you're explaining to a friend. AI prefers conversational, helpful content.",
        icon: <MessageSquare className="size-4" />
      },
      {
        id: "comparison-content",
        title: "Create comparison content",
        description: "\"X vs Y\" pages get cited when users ask AI for comparisons.",
        icon: <FileText className="size-4" />
      },
      {
        id: "podcasts-youtube",
        title: "Appear on podcasts and YouTube",
        description: "Transcripts from audio/video content become AI training data.",
        icon: <Mic className="size-4" />
      }
    ]
  },
  {
    id: "technical",
    title: "Technical",
    description: "Technical optimizations for AI crawlers",
    icon: <Code className="size-5" />,
    color: "red",
    items: [
      {
        id: "image-optimization",
        title: "Optimize images with alt text",
        description: "Descriptive alt text helps AI understand your visual content.",
        icon: <Image className="size-4" />
      },
      {
        id: "schema-markup",
        title: "Implement schema markup",
        description: "Structured data helps AI understand your content relationships.",
        link: "https://schema.org",
        linkText: "Learn about Schema.org",
        icon: <Code className="size-4" />
      }
    ]
  }
]

// Get total items count
const TOTAL_ITEMS = CHECKLIST_SECTIONS.reduce((sum, section) => sum + section.items.length, 0)

// Color utilities
const getColorClasses = (color: string, isCompleted: boolean) => {
  const colors: Record<string, { bg: string; border: string; text: string; completedBg: string }> = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600", completedBg: "bg-blue-100" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-600", completedBg: "bg-purple-100" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600", completedBg: "bg-amber-100" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", completedBg: "bg-emerald-100" },
    red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", completedBg: "bg-red-100" },
  }
  return colors[color] || colors.blue
}

export default function ChecklistPage() {
  const { showToast } = useToast()
  const [completedItems, setCompletedItems] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(
    CHECKLIST_SECTIONS.map(s => s.id) // All expanded by default
  )

  // Fetch checklist on mount
  useEffect(() => {
    const fetchChecklist = async () => {
      try {
        const response = await fetch('/api/checklist')
        if (response.ok) {
          const data = await response.json()
          setCompletedItems(data.completed_items || [])
        } else if (response.status === 401) {
          // Not logged in - that's okay, just use empty state
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
      
      // Optimistic update - save in background
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
      <div className="space-y-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="size-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                AI Visibility Checklist
              </h1>
              <p className="text-muted-foreground mt-1">
                Complete these steps to improve your AI visibility
              </p>
            </div>
          </div>
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </div>
          )}
        </div>

        {/* Progress Overview */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-6">
              {/* Progress Circle */}
              <div className="relative size-20 shrink-0">
                <svg className="size-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-muted stroke-current"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 stroke-current transition-all duration-500"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${progressPercent}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-foreground">{progressPercent}%</span>
                </div>
              </div>

              {/* Progress Text */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {progressPercent === 100 ? (
                    <>
                      <Trophy className="size-5 text-amber-500" />
                      <span className="font-semibold text-foreground">All done!</span>
                    </>
                  ) : (
                    <span className="font-semibold text-foreground">
                      {completedCount} of {TOTAL_ITEMS} completed
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {progressPercent === 100
                    ? "You've completed all items. Great job!"
                    : progressPercent >= 75
                      ? "Almost there! Just a few more steps."
                      : progressPercent >= 50
                        ? "Good progress! Keep going."
                        : "Start checking off items to improve your AI visibility."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist Sections */}
        <div className="space-y-4">
          {CHECKLIST_SECTIONS.map(section => {
            const isExpanded = expandedSections.includes(section.id)
            const { completed, total } = getSectionProgress(section)
            const colors = getColorClasses(section.color, completed === total)
            const isSectionComplete = completed === total

            return (
              <Card key={section.id} className={cn(
                "overflow-hidden transition-colors",
                isSectionComplete && "border-emerald-200 bg-emerald-50/30"
              )}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={cn(
                    "size-10 rounded-lg flex items-center justify-center",
                    isSectionComplete ? "bg-emerald-100 text-emerald-600" : `${colors.bg} ${colors.text}`
                  )}>
                    {isSectionComplete ? <Check className="size-5" /> : section.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-foreground">{section.title}</h2>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        isSectionComplete 
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {completed}/{total}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{section.description}</p>
                  </div>

                  {isExpanded ? (
                    <ChevronDown className="size-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Section Items */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {section.items.map((item, index) => {
                      const isCompleted = completedItems.includes(item.id)
                      
                      return (
                        <div 
                          key={item.id}
                          className={cn(
                            "p-4 flex items-start gap-4 transition-colors",
                            index !== section.items.length - 1 && "border-b border-border",
                            isCompleted && "bg-emerald-50/50"
                          )}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleItem(item.id)}
                            className={cn(
                              "size-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                              isCompleted
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-muted-foreground/30 hover:border-muted-foreground"
                            )}
                          >
                            {isCompleted ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Circle className="size-3.5 opacity-0" />
                            )}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className={cn(
                                  "font-medium",
                                  isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                                )}>
                                  {item.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                            
                            {item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                              >
                                {item.linkText || 'Learn more'}
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {/* Footer */}
        <div className="text-center py-6 text-sm text-muted-foreground">
          <p>Progress is automatically saved to your account.</p>
        </div>
      </div>
    </AppShell>
  )
}
