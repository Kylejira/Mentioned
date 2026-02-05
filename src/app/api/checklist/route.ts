import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

// GET /api/checklist - Get user's completed items
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_checklist')
      .select('completed_items, updated_at')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching checklist:', error)
      return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 })
    }

    return NextResponse.json({
      completed_items: data?.completed_items || [],
      updated_at: data?.updated_at || null
    })
  } catch (error) {
    console.error('Checklist GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/checklist - Update user's completed items
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { completed_items?: string[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { completed_items } = body

    if (!Array.isArray(completed_items)) {
      return NextResponse.json({ error: 'completed_items must be an array' }, { status: 400 })
    }

    // Validate item IDs against allowed values
    const allowedItems = [
      // Foundation
      "bing-webmaster", "google-search-console", "openai-submission", "crawl-accessibility",
      // Site Structure
      "clean-titles", "clear-descriptions", "category-structure",
      // Build Authority
      "reddit-quora", "review-platforms", "press-coverage", "wikipedia",
      // Content Optimization
      "natural-language", "comparison-content", "podcasts-youtube",
      // Technical
      "image-optimization", "schema-markup"
    ]

    const validItems = completed_items.filter(item => allowedItems.includes(item))

    // Upsert the checklist record
    const { data, error } = await supabase
      .from('user_checklist')
      .upsert({
        user_id: user.id,
        completed_items: validItems,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select('completed_items, updated_at')
      .single()

    if (error) {
      console.error('Error saving checklist:', error)
      return NextResponse.json({ error: 'Failed to save checklist' }, { status: 500 })
    }

    return NextResponse.json({
      completed_items: data?.completed_items || validItems,
      updated_at: data?.updated_at || new Date().toISOString()
    })
  } catch (error) {
    console.error('Checklist POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
