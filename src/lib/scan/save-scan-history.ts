import { createAdminClient } from '@/lib/supabase-admin';

interface ScanResult {
  productUrl: string;
  productName: string;
  category?: string;
  score: number;
  mentionRate: number;
  top3Rate: number;
  avgPosition?: number | null;
  chatgptScore?: number | null;
  claudeScore?: number | null;
  chatgptMentioned?: boolean | null;
  claudeMentioned?: boolean | null;
  fullResult?: Record<string, unknown> | null;
}

export async function saveScanHistory(userId: string, scanResult: ScanResult) {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('scan_history')
      .insert({
        user_id: userId,
        product_url: scanResult.productUrl,
        product_name: scanResult.productName,
        category: scanResult.category || null,
        score: scanResult.score,
        mention_rate: scanResult.mentionRate,
        top_3_rate: scanResult.top3Rate,
        avg_position: scanResult.avgPosition || null,
        chatgpt_score: scanResult.chatgptScore || null,
        claude_score: scanResult.claudeScore || null,
        chatgpt_mentioned: scanResult.chatgptMentioned ?? null,
        claude_mentioned: scanResult.claudeMentioned ?? null,
        full_result: scanResult.fullResult || null,
        scanned_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error('Error saving scan history:', error);
      return { error };
    }
    
    console.log('Scan history saved successfully for:', scanResult.productName);
    return { error: null };
  } catch (err) {
    console.error('Exception saving scan history:', err);
    return { error: err };
  }
}
