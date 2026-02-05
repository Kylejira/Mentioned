import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

// Lazy initialization to avoid errors when API key is not set
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

export const maxDuration = 30

type ContentType = "comparison" | "faq" | "positioning"

interface GenerateRequest {
  type: ContentType
  brandName: string
  competitors: string[]
  category: string
  description: string
}

const PROMPTS: Record<ContentType, (req: GenerateRequest) => string> = {
  comparison: (req) => `Write an outline for a comparison page for ${req.brandName} vs ${req.competitors.slice(0, 2).join(" and ") || "competitors"}.

Include: intro paragraph, comparison table structure, key differentiators, use case recommendations, conclusion.

${req.brandName} is: ${req.description}
Category: ${req.category}

Keep it honest and helpful, not salesy. Acknowledge trade-offs and be fair to competitors.
Output in markdown format with clear headings and structure.`,

  faq: (req) => `Write 6-8 FAQ questions and answers for ${req.brandName}, a ${req.category} tool.

${req.brandName} is: ${req.description}

Include questions like:
- What is ${req.brandName}?
- How does it compare to alternatives like ${req.competitors.slice(0, 2).join(" and ") || "other tools"}?
- Who is ${req.brandName} for?
- Pricing questions
- Integration/migration questions

Write in a helpful, conversational tone. Be specific and honest.
Output in markdown format.`,

  positioning: (req) => `Write 3 different options for homepage hero copy for ${req.brandName}.

${req.brandName} is: ${req.description}
Category: ${req.category}
Competitors include: ${req.competitors.join(", ") || "various tools in this space"}

Each option should have:
- Headline (under 10 words, clear and specific)
- Subheadline (1-2 sentences explaining the value)
- CTA button text (action-oriented)

Make each option distinct:
- Option A: Direct and specific
- Option B: Benefit-focused
- Option C: Differentiator-led

Be clear and specific, not generic. Avoid buzzwords.
Output in markdown format with clear separation between options.`,
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json()
    const { type, brandName, competitors, category, description } = body

    // Validate
    if (!type || !brandName || !description) {
      return NextResponse.json(
        { error: "Missing required fields: type, brandName, description" },
        { status: 400 }
      )
    }

    if (!["comparison", "faq", "positioning"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be: comparison, faq, or positioning" },
        { status: 400 }
      )
    }

    // Check if OpenAI is configured
    const client = getOpenAIClient()
    if (!client) {
      // Return mock content for development
      return NextResponse.json({
        content: getMockContent(type, brandName, competitors, category, description),
      })
    }

    // Generate content
    const prompt = PROMPTS[type]({
      type,
      brandName,
      competitors: competitors || [],
      category: category || "software",
      description,
    })

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful content strategist. Generate clear, actionable content that helps SaaS brands improve their marketing and AI visibility. Be specific, honest, and helpful.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    })

    const content = completion.choices[0]?.message?.content || ""

    return NextResponse.json({ content })
  } catch (error) {
    console.error("Generate error:", error)
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    )
  }
}

function getMockContent(
  type: ContentType,
  brandName: string,
  competitors: string[],
  category: string,
  description: string
): string {
  const competitorList = competitors.slice(0, 2).join(" and ") || "your competitors"

  if (type === "comparison") {
    return `# ${brandName} vs. ${competitorList}: Complete Comparison Guide

## Introduction

Choosing the right ${category} tool can significantly impact your team's productivity. This guide compares ${brandName} with ${competitorList} to help you make an informed decision.

## Quick Comparison Table

| Feature | ${brandName} | ${competitors[0] || "Competitor A"} | ${competitors[1] || "Competitor B"} |
|---------|-------------|-------------|-------------|
| Best for | [Your target audience] | [Their focus] | [Their focus] |
| Starting price | [Your price] | [Their price] | [Their price] |
| Key strength | [Your strength] | [Their strength] | [Their strength] |

## When to Choose ${brandName}

${brandName} is ideal if you:
- ${description.includes("for") ? description : `Need ${description}`}
- Value [key differentiator 1]
- Want [key differentiator 2]

## When to Choose Alternatives

Consider ${competitorList} if you:
- Need [specific feature they excel at]
- Have [specific requirement]

## Honest Trade-offs

**${brandName}'s limitations:**
- [Be honest about what you don't do well]

**${competitors[0] || "Competitor A"}'s limitations:**
- [Their weaknesses]

## Conclusion

Choose based on your specific needs. ${brandName} excels at [your strength], while alternatives may be better for [their strengths].`
  }

  if (type === "faq") {
    return `# Frequently Asked Questions

## What is ${brandName}?

${brandName} is a ${category} tool that ${description}. We help teams [specific outcome].

## How is ${brandName} different from ${competitorList}?

While ${competitorList} are excellent tools, ${brandName} is specifically designed for:
- [Key differentiator 1]
- [Key differentiator 2]
- [Key differentiator 3]

## Who is ${brandName} for?

${brandName} is ideal for:
- [Target user type 1]
- [Target user type 2]
- [Target user type 3]

## What does ${brandName} cost?

We offer transparent pricing:
- **Free tier:** [What's included]
- **Pro:** $X/month — [What's included]
- **Business:** $X/month — [What's included]

## Can I import my data from other tools?

Yes! We support imports from ${competitorList} and other popular ${category} tools. Most migrations complete in under an hour.

## Do you offer a free trial?

Yes, our free tier is fully functional for [limitations]. No credit card required.

## What integrations do you offer?

${brandName} integrates with [popular integrations relevant to your category].

## How do I get started?

1. Sign up at [your website]
2. [Quick start step 2]
3. [Quick start step 3]`
  }

  // positioning
  return `# Homepage Hero Copy Options

---

## Option A: Direct & Specific

**Headline:** ${category.charAt(0).toUpperCase() + category.slice(1)} for [your specific audience]

**Subheadline:** ${description}. Get started in minutes, not weeks.

**CTA:** Start free →

---

## Option B: Benefit-Focused

**Headline:** Your ${category} work, finally organized

**Subheadline:** ${brandName} brings together everything your team needs. Built for people who value simplicity over complexity.

**CTA:** Try ${brandName} free →

---

## Option C: Differentiator-Led

**Headline:** ${category.charAt(0).toUpperCase() + category.slice(1)}, minus the bloat

**Subheadline:** ${competitorList} are great for enterprises. ${brandName} is built for teams who want power without complexity.

**CTA:** See the difference →

---

## Key Messaging Points

Use these below the fold:
1. **For [your audience]** — "Built specifically for [target users]"
2. **Simple to start** — "Get running in minutes"
3. **[Your unique value]** — "[Specific benefit]"

## Words to Use
- [Category-specific terms]
- Simple, focused, streamlined
- [Your differentiators]

## Words to Avoid
- Enterprise, scalable, robust (too corporate)
- Revolutionary, game-changing (too hypey)
- [Generic terms in your space]`
}
