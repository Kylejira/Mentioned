import { createClient } from '@/lib/supabase-server';

export interface ScanHistoryEntry {
  id: string;
  productUrl: string;
  productName: string;
  category: string | null;
  score: number;
  mentionRate: number;
  top3Rate: number;
  avgPosition: number | null;
  chatgptScore: number | null;
  claudeScore: number | null;
  chatgptMentioned: boolean | null;
  claudeMentioned: boolean | null;
  scannedAt: string;
}

export async function getScanHistory(
  userId: string, 
  productUrl?: string,
  limit: number = 20
): Promise<ScanHistoryEntry[]> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('scan_history')
      .select('*')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: true })
      .limit(limit);
    
    // Filter by specific product URL if provided
    if (productUrl) {
      query = query.eq('product_url', productUrl);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching scan history:', error);
      return [];
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      id: row.id,
      productUrl: row.product_url,
      productName: row.product_name,
      category: row.category,
      score: row.score,
      mentionRate: row.mention_rate,
      top3Rate: row.top_3_rate,
      avgPosition: row.avg_position,
      chatgptScore: row.chatgpt_score,
      claudeScore: row.claude_score,
      chatgptMentioned: row.chatgpt_mentioned,
      claudeMentioned: row.claude_mentioned,
      scannedAt: row.scanned_at,
    }));
  } catch (err) {
    console.error('Exception fetching scan history:', err);
    return [];
  }
}

// Get all unique products a user has scanned
export async function getScannedProducts(userId: string): Promise<{ url: string; name: string; lastScore: number; lastScannedAt: string }[]> {
  try {
    const supabase = await createClient();
    
    // Get the most recent scan for each unique product URL
    const { data, error } = await supabase
      .from('scan_history')
      .select('product_url, product_name, score, scanned_at')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching scanned products:', error);
      return [];
    }
    
    // Deduplicate by product_url, keeping the most recent
    const productMap = new Map<string, { url: string; name: string; lastScore: number; lastScannedAt: string }>();
    
    for (const row of data || []) {
      if (!productMap.has(row.product_url)) {
        productMap.set(row.product_url, {
          url: row.product_url,
          name: row.product_name,
          lastScore: row.score,
          lastScannedAt: row.scanned_at,
        });
      }
    }
    
    return Array.from(productMap.values());
  } catch (err) {
    console.error('Exception fetching scanned products:', err);
    return [];
  }
}
