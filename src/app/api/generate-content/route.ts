import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { generateContent, ActionItem } from "@/lib/scan-v2/generate-actions"
import { ProductData } from "@/lib/scan-v2/extract-product"

export const maxDuration = 60 // 1 minute for content generation
export const dynamic = "force-dynamic"

interface GenerateRequest {
  action: ActionItem
  productData: ProductData
  topCompetitors: string[]
  generateType: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key required" },
        { status: 500 }
      )
    }

    let body: GenerateRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    const { action, productData, topCompetitors, generateType } = body

    if (!productData || !generateType) {
      return NextResponse.json(
        { error: "Missing required fields: productData, generateType" },
        { status: 400 }
      )
    }

    console.log(`[GenerateContent] Generating ${generateType} for ${productData.product_name}`)

    const result = await generateContent(
      action,
      productData,
      topCompetitors || [],
      generateType
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Content generation failed" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      content: result.content,
      generateType
    })

  } catch (error) {
    console.error("[GenerateContent] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
