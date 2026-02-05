import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

// Demo data - simulates scan history over the past few weeks
const DEMO_SCANS = [
  { daysAgo: 21, score: 23, mentionRate: 20, top3Rate: 5 },
  { daysAgo: 18, score: 31, mentionRate: 30, top3Rate: 10 },
  { daysAgo: 14, score: 38, mentionRate: 35, top3Rate: 15 },
  { daysAgo: 10, score: 45, mentionRate: 45, top3Rate: 20 },
  { daysAgo: 7, score: 56, mentionRate: 55, top3Rate: 30 },
  { daysAgo: 4, score: 67, mentionRate: 65, top3Rate: 45 },
  { daysAgo: 1, score: 78, mentionRate: 75, top3Rate: 55 },
]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - please log in first' }, { status: 401 })
    }

    // Get product info from request or use defaults
    let body: { productUrl?: string; productName?: string } = {}
    try {
      body = await request.json()
    } catch {
      // Use defaults if no body
    }

    let productUrl = body.productUrl
    let productName = body.productName

    // If no product info provided, try to get it from the user's brands table
    if (!productUrl || !productName) {
      const { data: brands } = await supabase
        .from('brands')
        .select('url, name')
        .eq('user_id', user.id)
        .limit(1)
      
      if (brands && brands.length > 0) {
        productUrl = productUrl || brands[0].url
        productName = productName || brands[0].name
      }
    }

    // If still no product info, try to get from existing scan_history
    if (!productUrl || !productName) {
      const { data: existingScans } = await supabase
        .from('scan_history')
        .select('product_url, product_name')
        .eq('user_id', user.id)
        .limit(1)
      
      if (existingScans && existingScans.length > 0) {
        productUrl = productUrl || existingScans[0].product_url
        productName = productName || existingScans[0].product_name
      }
    }

    // Final fallback to defaults
    productUrl = productUrl || 'https://demo-product.com'
    productName = productName || 'Demo Product'

    // Delete any existing demo data for this URL first
    await supabase
      .from('scan_history')
      .delete()
      .eq('user_id', user.id)
      .eq('product_url', productUrl)

    // Insert demo scan history
    const now = new Date()
    const demoEntries = DEMO_SCANS.map(scan => {
      const scanDate = new Date(now)
      scanDate.setDate(scanDate.getDate() - scan.daysAgo)
      
      return {
        user_id: user.id,
        product_url: productUrl,
        product_name: productName,
        category: 'Demo Category',
        score: scan.score,
        mention_rate: scan.mentionRate,
        top_3_rate: scan.top3Rate,
        avg_position: scan.score > 50 ? 2.5 : 5.0,
        chatgpt_score: Math.round(scan.score * 1.05),
        claude_score: Math.round(scan.score * 0.95),
        chatgpt_mentioned: scan.score > 30,
        claude_mentioned: scan.score > 40,
        scanned_at: scanDate.toISOString(),
      }
    })

    const { error: insertError } = await supabase
      .from('scan_history')
      .insert(demoEntries)

    if (insertError) {
      console.error('Error inserting demo data:', insertError)
      return NextResponse.json({ error: 'Failed to insert demo data', details: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Created ${demoEntries.length} demo scan entries`,
      productUrl,
      productName,
      instruction: 'Go to /dashboard to see the progress graph'
    })
  } catch (error) {
    console.error('Demo data error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to check current demo status
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .eq('user_id', user.id)
      .order('scanned_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    return NextResponse.json({ 
      count: data?.length || 0,
      history: data || []
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE endpoint to remove demo data
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productUrl = searchParams.get('productUrl') || 'https://demo-product.com'

    const { error } = await supabase
      .from('scan_history')
      .delete()
      .eq('user_id', user.id)
      .eq('product_url', productUrl)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete demo data' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Demo data deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
