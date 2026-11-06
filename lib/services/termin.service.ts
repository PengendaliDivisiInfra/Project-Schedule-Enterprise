import { supabase } from '@/lib/supabase';
import { 
  ClientContract, ClientInvoice, ClientInvoiceSummary, ProjectTermin, 
  CreateContractInput, CreateTerminInput, IssueInvoiceInput, 
  calcRetention, calcOutstanding 
} from '@/lib/types/termin';

export async function getContractByProject(projectId: string) {
  const { data, error } = await supabase
    .from('client_contracts')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ClientContract | null;
}

export async function createContract(input: CreateContractInput) {
  const { data, error } = await supabase
    .from('client_contracts')
    .insert(input)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ClientContract;
}

export async function listTermins(projectId: string) {
  const { data, error } = await supabase
    .from('project_termins')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('termin_no', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectTermin[];
}

export async function createTerminDraft(input: CreateTerminInput) {
  const retentionAmount = calcRetention(input.gross_amount, input.retention_pct);
  const netAmount = Number((input.gross_amount - retentionAmount).toFixed(2));

  const { data, error } = await supabase
    .from('project_termins')
    .insert({ ...input, retention_amount: retentionAmount, net_amount: netAmount, status: 'Draft' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectTermin;
}

export async function approveTermin(terminId: string) {
  const { data, error } = await supabase.rpc('rpc_approve_termin', { p_termin_id: terminId });
  if (error) throw new Error(error.message);
  return data as ProjectTermin;
}

export async function listInvoices(projectId: string) {
  const { data, error } = await supabase
    .from('v_client_invoice_summary')
    .select('*')
    .eq('project_id', projectId)
    .order('invoice_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientInvoiceSummary[];
}

export async function issueInvoice(input: IssueInvoiceInput) {
  const { data, error } = await supabase.rpc('rpc_issue_invoice', {
    p_termin_id: input.termin_id,
    p_invoice_number: input.invoice_number,
    p_invoice_date: input.invoice_date,
    p_due_date: input.due_date ?? null,
    p_ppn_pct: input.ppn_pct ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as ClientInvoice;
}

export function computeOutstanding(inv: ClientInvoice): number {
  return calcOutstanding(inv.net_payable_amount, inv.paid_amount);
}