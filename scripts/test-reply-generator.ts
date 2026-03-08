import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { generateReplies } from "../src/lib/reply-generator/reply-generator"
import type { ProductProfile, ConversationContext } from "../src/lib/reply-generator/reply-generator"
import { validateReply } from "../src/lib/reply-generator/reply-validator"

const profile: ProductProfile = {
  product_name: "Pika",
  one_liner: "Pika helps creators make AI-generated videos from text and image prompts",
  description: "Pika is an AI video generation platform that lets you create and edit videos using text prompts, images, or existing footage. It supports text-to-video, image-to-video, and video-to-video workflows.",
  key_features: [
    "text-to-video generation",
    "image-to-video animation",
    "lip sync",
    "video extend and editing",
    "multiple aspect ratios",
  ],
  target_audience: "content creators, social media managers, and marketers",
  use_cases: [
    "TikTok and Reels content",
    "product demo videos",
    "social media ads",
    "YouTube shorts",
  ],
  competitors: ["Runway", "Kling", "Sora", "Luma Dream Machine"],
  website_url: "https://pika.art",
  preferred_tone: "helpful",
  custom_instructions: null,
}

const conversations: ConversationContext[] = [
  {
    id: "test-1",
    platform: "reddit",
    title: "Best AI video generator for social media clips?",
    text: "I'm looking for an AI video tool to create short clips for TikTok and Instagram. I've tried a few but they all look super artificial. Budget is around $30/mo. What are people actually using that looks decent?",
    full_thread_text: null,
  },
  {
    id: "test-2",
    platform: "reddit",
    title: "Runway vs Kling - which one should I go with?",
    text: "Been going back and forth between Runway and Kling for a while now. Runway has better UI but Kling seems to produce more natural motion. Anyone tried both extensively? Mainly need it for product demos and social content.",
    full_thread_text: "I've used both. Runway Gen-3 is more consistent but Kling has better motion for certain styles. Really depends on what aesthetic you're going for.\n\nHonestly Kling has been my go-to lately. The motion quality jumped a lot with their latest update.",
  },
  {
    id: "test-3",
    platform: "twitter",
    title: null,
    text: "what's the current state of AI video? tried midjourney video and it was... mid. need something that can do text to video that doesn't look like a fever dream",
    full_thread_text: null,
  },
  {
    id: "test-4",
    platform: "reddit",
    title: "Free AI video generators that are actually usable?",
    text: "I'm a student working on a film project and can't afford expensive subscriptions. Are there any free AI video generators that produce reasonable quality? Doesn't need to be perfect, just needs to not look terrible.",
    full_thread_text: "Check out Luma Dream Machine, they have a free tier.\n\nKling also has some free credits when you sign up.",
  },
  {
    id: "test-5",
    platform: "reddit",
    title: "How are people using AI video for e-commerce product videos?",
    text: "We sell physical products and want to create short video ads without hiring a videographer for every SKU. Has anyone had success using AI video tools for product marketing? What's the workflow look like? We have good product photos already.",
    full_thread_text: null,
  },
]

async function runTest() {
  console.log("=".repeat(70))
  console.log("AI REPLY GENERATOR — QUALITY TEST")
  console.log("=".repeat(70))
  console.log()

  for (const conv of conversations) {
    console.log("-".repeat(70))
    console.log(`CONVERSATION: ${conv.title || conv.text.slice(0, 60)}...`)
    console.log(`Platform: ${conv.platform}`)
    console.log(`Text: ${conv.text.slice(0, 120)}...`)
    console.log()

    try {
      const result = await generateReplies(conv, profile)

      for (const reply of result.replies) {
        const tag = reply.mentions_product ? "WITH PRODUCT" : "NO PRODUCT"
        console.log(`  [${tag}] — ${reply.approach}`)
        console.log(`  Validation: ${reply.validation.passed ? "PASSED" : "FAILED — " + reply.validation.issues.join(", ")}`)
        console.log()
        console.log(`  "${reply.text}"`)
        console.log()

        // Run validation again independently to double-check
        const v = validateReply(reply.text, profile.product_name)
        if (!v.passed) {
          console.log(`  ⚠ INDEPENDENT VALIDATION FAILED: ${v.issues.join(", ")}`)
          console.log()
        }
      }

      console.log(`  Tokens used: ${result.tokens_used}`)
    } catch (err) {
      console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`)
    }

    console.log()
  }

  console.log("=".repeat(70))
  console.log("TEST COMPLETE")
  console.log("=".repeat(70))
}

runTest().catch(console.error)
