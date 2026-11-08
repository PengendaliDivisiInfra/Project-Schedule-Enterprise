import { supabase } from '@/lib/supabase';
import { COA } from '@/lib/types/coa';

export const coaService = {
  async getActiveCOAs(): Promise<COA[]> {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('is_deleted', false)
      .order('kode_akun', { ascending: true });
      
    if (error) throw error;
    return data || [];
  },

  async createCOA(payload: Omit<COA, 'id' | 'tenant_id'>): Promise<void> {
    // RLS Supabase akan otomatis menangani tenant_id
    const { error } = await supabase.from('chart_of_accounts').insert([payload]);
    if (error) throw error;
  },

  async updateCOA(id: string, payload: Partial<COA>): Promise<void> {
    const { error } = await supabase.from('chart_of_accounts').update(payload).eq('id', id);
    if (error) throw error;
  },

  async softDeleteCOA(id: string): Promise<void> {
    // ABSOLUTE RULE: Dilarang Hard Delete
    const { error } = await supabase
      .from('chart_of_accounts')
      .update({ is_deleted: true, status: 'Inaktif' })
      .eq('id', id);
    if (error) throw error;
  }
};