import { supabase } from '@/lib/supabase';
import { RetentionRelease } from '@/lib/types/termin';

export async function listReleases(contractId: string) {
  const { data, error } = await supabase
    .from('retention_releases')
    .select('*')
    .eq('contract_id', contractId)
    .order('release_no', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RetentionRelease[];
}

export async function releaseRetention(input: {
  contract_id: string;
  release_no: number;
  release_date: string;
  amount: number;
  receipt_number: string;
  bank_name?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc('rpc_release_retention', {
    p_contract_id: input.contract_id,
    p_release_no: input.release_no,
    p_release_date: input.release_date,
    p_amount: input.amount,
    p_receipt_number: input.receipt_number,
    p_bank_name: input.bank_name ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as RetentionRelease;
}