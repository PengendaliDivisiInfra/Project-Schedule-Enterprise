import { supabase } from '@/lib/supabase';
import type {
  ClientContract, ClientInvoice, ClientInvoiceSummary,
  ProjectTermin, CreateContractInput, CreateTerminInput, IssueInvoiceInput,
} from '@/lib/types/termin';
import { calcNetPayable, calcOutstanding, calcPpn, calcRetention, calcTotalInvoice } from '@/lib/types/termin';

// ===== CONTRACT =====
export async function getContractByProject(projectId: string) {
  // 1. Cek apakah kontrak sudah ada di client_contracts
  let { data: contract, error } = await supabase
    .from('client_contracts')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // 2. Jika belum ada, AUTO-SYNC dari tabel projects
  if (!contract) {
    // Gunakan select('*') agar tidak error jika nama kolom berbeda
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (project) {
      // Deteksi nama kolom secara fleksibel (Inggris / Indonesia)
      const cNumber = project.contract_number || project.nomor_kontrak || `AUTO/${Date.now()}`;
      const cName = project.name || project.project_name || project.nama_proyek || 'Kontrak Utama';
      const cValue = Number(project.contract_value || project.nilai_kontrak || 0);

      // Buat kontrak secara otomatis di latar belakang
      const { data: newContract, error: insertError } = await supabase
        .from('client_contracts')
        .insert([{
          project_id: projectId,
          contract_number: cNumber,
          contract_name: cName,
          contract_value: cValue,
          retention_pct: 5, // default
          ppn_pct: 11, // default
          status: 'Active'
        }])
        .select()
        .single();

      if (!insertError) {
        contract = newContract;
      } else {
        console.error("Gagal auto-sync kontrak:", insertError.message);
      }
    }
  }

  return contract as ClientContract | null;
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

// ===== TERMIN =====
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

// ===== INVOICE =====
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
  const { data: termin } = await supabase
    .from('project_termins')
    .select('*')
    .eq('id', input.termin_id)
    .single();

  if (termin) {
    const t = termin as ProjectTermin;
    const ppn = calcPpn(t.gross_amount, input.ppn_pct ?? 11);
    const retention = calcRetention(t.gross_amount, t.retention_pct);
    const total = calcTotalInvoice(t.gross_amount, ppn);
    const net = calcNetPayable(total, retention);
    // eslint-disable-next-line no-console
    console.debug('Invoice preview', { dpp: t.gross_amount, ppn, retention, total, net });
  }

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