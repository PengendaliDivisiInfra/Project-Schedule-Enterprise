import { supabase } from '@/lib/supabase';

export interface CashFlow {
  id: string;
  project_id: string;
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  description: string | null;
  approval_status: string;
  created_at: string;
}

export async function getCashFlows(projectId?: string) {
  let query = supabase
    .from('cash_flows')
    .select('*')
    .order('created_at', { ascending: false });

  // Jika dipanggil dari halaman proyek tertentu
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as CashFlow[];
}