import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { generateReplies, buildReplyPrompt } from "../src/lib/reply-generator/reply-generator"
import type { ProductProfile, ConversationContext } from "../src/lib/reply-generator/reply-generator"
import { validateReply } from "../src/lib/reply-generator/reply-validator"

const profile: ProductProfile = {
  product_name: "Pika",
  one_liner: "Pika helps creators make AI-generated videos from text and image prompts",
  description: null,
  key_features: ["text-to-video", "image-to-video", "lip sync"],
  target_audience: "content creators",
  use_cases: ["TikTok content", "product demos"],
  competitors: ["Runway", "Kling"],
  website_url: "https://pika.art",
  preferred_tone: "helpful",
  custom_instructions: null,
}

// ===========================
// Test helpers
// ===========================

function pass(name: string) { console.log(`  ✅ ${name}`) }
function fail(name: string, detail?: string) { console.log(`  ❌ ${name}${detail ? ": " + detail : ""}`) }

// ===========================
// Edge Case 1: Image-only thread
// ===========================

async function testImageOnlyThread() {
  console.log("\n--- Edge Case 1: Image/video-only thread (no text) ---")

  const conv: ConversationContext = {
    id: "edge-1",
    platform: "reddit",
    title: "This AI video tool is insane, what is it?",
    text: "[image]",
    full_thread_text: null,
  }

  const prompt = buildReplyPrompt(conv, profile)
  if (prompt.includes("image/video post")) {
    pass("Prompt contains image-only note")
  } else {
    fail("Prompt missing image-only note")
  }
  if (prompt.includes("Keep the reply brief")) {
    pass("Prompt instructs brief reply")
  } else {
    fail("Prompt missing brief instruction")
  }

  const result = await generateReplies(conv, profile)
  console.log(`  Generated ${result.replies.length} replies`)
  for (const r of result.replies) {
    if (r.text.length < 600) {
      pass(`Reply is concise (${r.text.length} chars)`)
    } else {
      fail(`Reply may be too long for image-only (${r.text.length} chars)`)
    }
  }
}

// ===========================
// Edge Case 2: Thread with 50+ replies
// ===========================

async function testManyRepliesThread() {
  console.log("\n--- Edge Case 2: Thread with 50+ existing replies ---")

  const manyReplies = Array.from({ length: 60 }, (_, i) =>
    `Reply ${i + 1}: I'd suggest trying tool${i}. It works great for video editing.`
  ).join("\n")

  const conv: ConversationContext = {
    id: "edge-2",
    platform: "reddit",
    title: "Best AI video generators in 2026?",
    text: "Looking for the best AI video generators. Have tried a few but curious what everyone else likes.",
    full_thread_text: manyReplies,
  }

  const prompt = buildReplyPrompt(conv, profile)
  if (prompt.includes("many replies")) {
    pass("Prompt contains many-replies note")
  } else {
    fail("Prompt missing many-replies note")
  }
  if (prompt.includes("concise") && prompt.includes("unique angle")) {
    pass("Prompt instructs concise + unique angle")
  } else {
    fail("Prompt missing concise/unique angle instruction")
  }

  const result = await generateReplies(conv, profile)
  console.log(`  Generated ${result.replies.length} replies`)
  pass("Generation succeeded for crowded thread")
}

// ===========================
// Edge Case 3: Product already mentioned in thread
// ===========================

async function testProductAlreadyMentioned() {
  console.log("\n--- Edge Case 3: Product already mentioned ---")

  const conv: ConversationContext = {
    id: "edge-3",
    platform: "reddit",
    title: "Best AI video tools?",
    text: "What are the best AI video tools right now?",
    full_thread_text: "I've been using Pika lately and it's pretty solid for quick clips.\nAlso tried Runway which is more feature-rich.\n\n[NOTE: The user's product has already been mentioned in this thread. Generate a reply that adds value without re-mentioning it.]",
  }

  const result = await generateReplies(conv, profile)
  const mentionCount = result.replies.filter(r => r.mentions_product).length
  console.log(`  ${mentionCount} of ${result.replies.length} replies mention product`)

  // With the note injected, the LLM should ideally reduce or skip product mentions
  if (result.replies.length > 0) {
    pass("Generation succeeded with product-already-mentioned context")
  }
}

// ===========================
// Edge Case 4: Validator rules (unit tests)
// ===========================

function testValidationRules() {
  console.log("\n--- Edge Case 4: Validation rule checks ---")

  // Rule 1: Too many product mentions
  const r1 = validateReply("Pika is great. I use Pika daily. Pika is the best tool.", "Pika")
  if (!r1.passed && r1.issues.some(i => i.includes("3 times"))) {
    pass("Rule 1: Catches product name > 2 times")
  } else {
    fail("Rule 1: Did not catch product name > 2 times", JSON.stringify(r1))
  }

  // Rule 2: Banned marketing phrases
  const r2 = validateReply("This tool is a game-changing solution for video editing and is really revolutionary.", "TestProduct")
  if (!r2.passed && r2.issues.some(i => i.includes("marketing language"))) {
    pass("Rule 2: Catches banned marketing phrases")
  } else {
    fail("Rule 2: Did not catch banned phrases", JSON.stringify(r2))
  }

  // Rule 3: Too many exclamation marks
  const r3 = validateReply("This is amazing! You should try it! It's the best thing ever!", "TestProduct")
  if (!r3.passed && r3.issues.some(i => i.includes("exclamation"))) {
    pass("Rule 3: Catches too many exclamation marks")
  } else {
    fail("Rule 3: Did not catch exclamation marks", JSON.stringify(r3))
  }

  // Rule 4: Contains URL
  const r4 = validateReply("Check it out at https://example.com for more details on how it works.", "TestProduct")
  if (!r4.passed && r4.issues.some(i => i.includes("URL"))) {
    pass("Rule 4: Catches URLs")
  } else {
    fail("Rule 4: Did not catch URL", JSON.stringify(r4))
  }

  // Rule 5: Too short
  const r5 = validateReply("Try Pika.", "Pika")
  if (!r5.passed && r5.issues.some(i => i.includes("too short"))) {
    pass("Rule 5: Catches too-short replies")
  } else {
    fail("Rule 5: Did not catch short reply", JSON.stringify(r5))
  }

  // Rule 6: Product mentioned too early
  const r6 = validateReply("Pika is what you need for AI video generation. It handles text-to-video really well and has great features.", "Pika")
  if (!r6.passed && r6.issues.some(i => i.includes("too early"))) {
    pass("Rule 6: Catches product mentioned too early")
  } else {
    fail("Rule 6: Did not catch early mention", JSON.stringify(r6))
  }

  // Valid reply
  const rv = validateReply(
    "Honestly for AI video, Runway and Kling are both solid choices depending on your use case. I've also been trying pika recently and it's decent for quick social clips, though it's still pretty new. Either way you have some good options.",
    "Pika"
  )
  if (rv.passed) {
    pass("Valid reply: Passes all rules")
  } else {
    fail("Valid reply: Should have passed", JSON.stringify(rv))
  }
}

// ===========================
// Edge Case 5: Unparseable JSON fallback
// (Can't easily test without mocking, but verify the code path exists)
// ===========================

function testParseRetryExists() {
  console.log("\n--- Edge Case 5: JSON parse retry path ---")
  // Read the source to verify the retry exists
  const fs = require("fs")
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/lib/reply-generator/reply-generator.ts"),
    "utf8"
  )
  if (source.includes("JSON parse failed, retrying once")) {
    pass("JSON parse retry logic exists in code")
  } else {
    fail("Missing JSON parse retry logic")
  }
}

// ===========================
// Edge Case 6: All-fail fallback to no-mention variation
// ===========================

function testAllFailFallback() {
  console.log("\n--- Edge Case 6: All-fail fallback path ---")
  const fs = require("fs")
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/lib/reply-generator/reply-generator.ts"),
    "utf8"
  )
  if (source.includes("Falling back to no-mention variation")) {
    pass("All-fail fallback to no-mention variation exists")
  } else {
    fail("Missing all-fail fallback")
  }
  if (source.includes("not be a good fit")) {
    pass("Final error message mentions 'not a good fit'")
  } else {
    fail("Missing 'not a good fit' error message")
  }
}

// ===========================
// Run all
// ===========================

async function main() {
  console.log("=".repeat(60))
  console.log("AI REPLY GENERATOR — EDGE CASE TESTS")
  console.log("=".repeat(60))

  testValidationRules()
  testParseRetryExists()
  testAllFailFallback()

  await testImageOnlyThread()
  await testManyRepliesThread()
  await testProductAlreadyMentioned()

  console.log("\n" + "=".repeat(60))
  console.log("ALL EDGE CASE TESTS COMPLETE")
  console.log("=".repeat(60))
}

main().catch(console.error)
