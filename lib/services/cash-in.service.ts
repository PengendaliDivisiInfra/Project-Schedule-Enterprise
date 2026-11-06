import { supabase } from '@/lib/supabase';
import { ClientReceipt, RecordReceiptInput } from '@/lib/types/termin';

export async function listReceipts(projectId: string, invoiceId?: string) {
  let q = supabase
    .from('client_receipts')
    .select('*')
    .eq('project_id', projectId)
    .order('receipt_date', { ascending: false });

  if (invoiceId) q = q.eq('invoice_id', invoiceId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientReceipt[];
}

export async function recordReceipt(input: RecordReceiptInput) {
  const { data, error } = await supabase.rpc('rpc_record_client_receipt', {
    p_invoice_id: input.invoice_id,
    p_receipt_number: input.receipt_number,
    p_receipt_date: input.receipt_date,
    p_amount: input.amount,
    p_bank_name: input.bank_name ?? null,
    p_bank_account: input.bank_account ?? null,
    p_reference_no: input.reference_no ?? null,
    p_proof_url: input.proof_url ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as ClientReceipt;
}

export async function voidReceipt(receiptId: string, reason: string) {
  const { data, error } = await supabase.rpc('rpc_void_client_receipt', {
    p_receipt_id: receiptId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as ClientReceipt;
}