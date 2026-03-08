// ---------------------------------------------------------------------------
// AI Visibility Playbook — Static task definitions
// No API calls, no database. Pure data.
// ---------------------------------------------------------------------------

export interface PlaybookTask {
  id: string
  title: string
  description: string
  detailed_instructions: string
  priority: "critical" | "high" | "medium"
  category: "setup" | "content" | "optimization" | "maintenance"
  estimated_minutes: number
  score_impact: number
  relevant_when: {
    score_below?: number
    score_above?: number
    mention_rate_below?: number
    provider_gap?: boolean
  }
  external_url?: string
  guide_url?: string
}

export const PLAYBOOK_TASKS: PlaybookTask[] = [
  {
    id: "bing-webmaster",
    title: "Register with Bing Webmaster Tools",
    description:
      "Bing powers ChatGPT browsing and Perplexity. If your site isn't indexed by Bing, AI systems may never discover your product.",
    detailed_instructions:
      "Go to bing.com/webmasters, sign in with a Microsoft account, add your site URL, verify ownership via DNS or meta tag, and submit your sitemap.",
    priority: "critical",
    category: "setup",
    estimated_minutes: 10,
    score_impact: 8,
    relevant_when: { score_below: 40 },
    external_url: "https://www.bing.com/webmasters",
  },
  {
    id: "google-search-console",
    title: "Set up Google Search Console",
    description:
      "Google's index feeds Gemini and other AI systems. Search Console ensures Google can crawl and index your site properly.",
    detailed_instructions:
      "Go to search.google.com/search-console, sign in with your Google account, add your property, verify ownership, and submit your sitemap.",
    priority: "critical",
    category: "setup",
    estimated_minutes: 10,
    score_impact: 6,
    relevant_when: { score_below: 40 },
    external_url: "https://search.google.com/search-console",
  },
  {
    id: "submit-openai",
    title: "Submit your brand to OpenAI",
    description:
      "Submitting helps associate your company with known entities used in ChatGPT responses. This directly influences how OpenAI's models reference your product.",
    detailed_instructions:
      "Visit OpenAI's brand submission page (if available), or ensure your brand has a well-structured Wikipedia page, Crunchbase profile, and consistent mentions across authoritative sources that OpenAI's crawlers index.",
    priority: "high",
    category: "setup",
    estimated_minutes: 15,
    score_impact: 5,
    relevant_when: { score_below: 50 },
  },
  {
    id: "fix-crawl-blockers",
    title: "Remove crawler blockers",
    description:
      "If AI crawlers can't access your site, your brand stays invisible. Check your robots.txt and make sure you're not blocking GPTBot, ClaudeBot, or Googlebot.",
    detailed_instructions:
      "Check your robots.txt file at yourdomain.com/robots.txt. Remove any Disallow rules for GPTBot, ClaudeBot, CCBot, or Googlebot. Also check your server-side rendering — if your site requires JavaScript to display content, crawlers may see a blank page.",
    priority: "critical",
    category: "setup",
    estimated_minutes: 20,
    score_impact: 10,
    relevant_when: { score_below: 30 },
  },
  {
    id: "site-structure",
    title: "Improve site structure and metadata",
    description:
      "Clean titles, clear categories, and descriptive meta tags help AI systems understand what your product does and who it's for.",
    detailed_instructions:
      "Audit your page titles, meta descriptions, and heading hierarchy. Each page should have a clear H1 that describes the page topic. Use schema markup (JSON-LD) for your product, organization, and FAQ pages. Ensure your sitemap is up to date.",
    priority: "high",
    category: "optimization",
    estimated_minutes: 30,
    score_impact: 7,
    relevant_when: { score_below: 60 },
  },
  {
    id: "publish-trusted-platforms",
    title: "Publish on platforms AI already reads",
    description:
      "AI models scrape Reddit, Quora, Medium, Wikipedia, and press sites. Publishing genuine content on these platforms trains AI to associate your brand with your category.",
    detailed_instructions:
      "Write helpful, non-promotional posts on Reddit (relevant subreddits), answer questions on Quora, publish articles on Medium or your company blog, and seek press coverage or guest posts on industry sites. Focus on being genuinely helpful — AI models weight authentic engagement.",
    priority: "high",
    category: "content",
    estimated_minutes: 60,
    score_impact: 12,
    relevant_when: { mention_rate_below: 0.3 },
  },
  {
    id: "match-human-language",
    title: "Match real buyer language in your content",
    description:
      'Use the exact phrases customers type when asking AI for recommendations. If they ask "best email API for developers" and your site says "enterprise communication platform", AI won\'t make the connection.',
    detailed_instructions:
      "Review the queries from your scan results. Note the exact language buyers use. Update your website copy, blog posts, and landing pages to include these natural phrases. Focus on H1s, H2s, and the first paragraph of key pages.",
    priority: "high",
    category: "optimization",
    estimated_minutes: 45,
    score_impact: 10,
    relevant_when: { score_below: 50, mention_rate_below: 0.4 },
  },
  {
    id: "expand-footprint",
    title: "Expand your digital footprint",
    description:
      "Reviews, podcasts, YouTube mentions, and guest articles all signal credibility to AI models. The wider the web mentions you, the safer you look to AI systems.",
    detailed_instructions:
      "Get listed on G2, Capterra, Product Hunt, and relevant directories. Appear on podcasts and YouTube channels in your niche. Encourage customers to leave reviews. Each new authoritative mention strengthens your AI visibility.",
    priority: "medium",
    category: "content",
    estimated_minutes: 120,
    score_impact: 8,
    relevant_when: { score_below: 70 },
  },
  {
    id: "optimize-visuals",
    title: "Optimize visual assets for AI",
    description:
      'Descriptive file names, real alt text, and context on every product image help AI systems understand your visual content. "dashboard-analytics-screenshot.png" beats "img_2847.png".',
    detailed_instructions:
      "Rename image files to be descriptive. Add meaningful alt text to every image (not keyword stuffing — describe what's shown). Add captions where appropriate. Ensure product screenshots have surrounding text context.",
    priority: "medium",
    category: "optimization",
    estimated_minutes: 30,
    score_impact: 4,
    relevant_when: { score_below: 70 },
  },
  {
    id: "create-comparison-content",
    title: "Create comparison and list content",
    description:
      'Pages like "[Your Product] vs [Competitor]" and "Best tools for [category]" are exactly what AI models extract when answering buyer questions. Publishing these gives AI a structured source to reference.',
    detailed_instructions:
      "Create dedicated comparison pages for your top 3-5 competitors. Write a comprehensive \"Best [category] tools\" listicle that includes your product. Structure these with clear headings, feature tables, and honest pros/cons. AI models love structured, factual comparison content.",
    priority: "high",
    category: "content",
    estimated_minutes: 90,
    score_impact: 15,
    relevant_when: { mention_rate_below: 0.5 },
  },
]
