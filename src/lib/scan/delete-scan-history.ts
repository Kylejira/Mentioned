import { createClient } from '@/lib/supabase-server';

export async function deleteScanHistory(userId: string, scanId: string) {
  try {
    const supabase = await createClient();
    
    // Verify the scan belongs to this user before deleting
    const { data: scan, error: fetchError } = await supabase
      .from('scan_history')
      .select('id, user_id')
      .eq('id', scanId)
      .single();
    
    if (fetchError || !scan) {
      return { error: 'Scan not found' };
    }
    
    if (scan.user_id !== userId) {
      return { error: 'Unauthorized' };
    }
    
    const { error } = await supabase
      .from('scan_history')
      .delete()
      .eq('id', scanId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting scan:', error);
      return { error: 'Failed to delete scan' };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Exception deleting scan:', err);
    return { error: 'Failed to delete scan' };
  }
}
