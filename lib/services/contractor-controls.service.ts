// lib/services/contractor-controls.service.ts
import { supabase } from '@/lib/supabase';
import { recordAuditEvent } from '@/lib/services/logs.service';
import { computeBakpProgressBilling, type BakpBillingResult } from '@/lib/utils/contractor-controls';

// ==========================================
// 1. RING-FENCED PROJECT CASHFLOW
// ==========================================
export interface RingFencedCashflowRow {
  project_id: string;
  project_name: string;
  ring_fenced_cashflow: boolean;
  hq_dropping_limit: number;
  total_client_inflow: number;
  total_hq_dropping: number;
  total_actual_outflow: number;
  total_pending_outflow: number;
  ringfenced_cash_balance: number;
  is_deficit: boolean;
}

export async function getRingFencedCashflow(projectId: string): Promise<RingFencedCashflowRow | null> {
  const { data, error } = await supabase
    .from('v_project_ringfenced_cashflow')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    console.warn('v_project_ringfenced_cashflow belum tersedia:', error.message);
    return null;
  }
  if (!data) return null;

  return {
    ...data,
    hq_dropping_limit: Number(data.hq_dropping_limit || 0),
    total_client_inflow: Number(data.total_client_inflow || 0),
    total_hq_dropping: Number(data.total_hq_dropping || 0),
    total_actual_outflow: Number(data.total_actual_outflow || 0),
    total_pending_outflow: Number(data.total_pending_outflow || 0),
    ringfenced_cash_balance: Number(data.ringfenced_cash_balance || 0),
    is_deficit: Boolean(data.is_deficit),
  };
}

// ==========================================
// 2. BANK GUARANTEES & RETENTION MATURITY
// ==========================================
export async function listBankGuarantees(projectId: string) {
  const { data, error } = await supabase
    .from('bank_guarantees')
    .select('*')
    .eq('project_id', projectId)
    .order('expiry_date', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function createBankGuarantee(payload: {
  project_id: string;
  contract_id?: string | null;
  guarantee_type: 'PERFORMANCE_BOND' | 'ADVANCE_PAYMENT_BOND' | 'MAINTENANCE_BOND' | 'BID_BOND';
  guarantee_number: string;
  issuing_bank: string;
  amount: number;
  issue_date: string;
  expiry_date: string;
  document_url?: string | null;
  notes?: string | null;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('bank_guarantees')
    .insert({
      ...payload,
      created_by: userRes?.user?.id || null,
      status: 'Active',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: payload.project_id,
    tableName: 'bank_guarantees',
    action: 'INSERT',
    recordId: data.id,
    newData: {
      guarantee_type: payload.guarantee_type,
      guarantee_number: payload.guarantee_number,
      amount: payload.amount,
      expiry_date: payload.expiry_date,
    },
  });

  return data;
}

export async function updateBankGuaranteeStatus(
  id: string,
  projectId: string,
  status: 'Active' | 'Released' | 'Claimed' | 'Expired'
) {
  const { error } = await supabase
    .from('bank_guarantees')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'bank_guarantees',
    action: 'UPDATE',
    recordId: id,
    newData: { status },
  });
}

export async function updateContractRetentionDueDate(
  contractId: string,
  projectId: string,
  retentionDueDate: string | null
) {
  const { error } = await supabase
    .from('client_contracts')
    .update({ retention_due_date: retentionDueDate, updated_at: new Date().toISOString() })
    .eq('id', contractId)
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);
}

// ==========================================
// 3. BAKP AUTOMATED PROGRESS BILLING
// ==========================================
export async function getVerifiedBakpProgress(
  projectId: string,
  contractValue: number,
  retentionPct: number = 5,
  ppnPct: number = 11
): Promise<BakpBillingResult> {
  const [{ data: tasks }, { data: prevTermins }] = await Promise.all([
    supabase
      .from('wbs_tasks')
      .select('cost, progress_percent, summary')
      .eq('project_id', projectId),
    supabase
      .from('project_termins')
      .select('actual_progress_pct, status')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .neq('status', 'Void'),
  ]);

  const maxPrevPct = (prevTermins || []).reduce(
    (max, t: any) => Math.max(max, Number(t.actual_progress_pct || 0)),
    0
  );

  return computeBakpProgressBilling({
    wbsTasks: (tasks || []).map((t: any) => ({
      cost: Number(t.cost || 0),
      progressPercent: Number(t.progress_percent || 0),
      summary: t.summary,
    })),
    contractValue,
    previousProgressPct: maxPrevPct,
    retentionPct,
    ppnPct,
  });
}

// ==========================================
// 4. RAB VERSIONS, CCO / ADDENDUM & UNAPPROVED WORK ALERT
// ==========================================
export async function listRabVersions(projectId: string) {
  const { data, error } = await supabase
    .from('rab_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_no', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function lockRabBaseline(projectId: string, notes?: string) {
  const { data, error } = await supabase.rpc('rpc_lock_rab_baseline', {
    p_project_id: projectId,
    p_notes: notes || null,
  });

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'rab_versions',
    action: 'INSERT',
    recordId: (data as any)?.version_id || null,
    newData: data as any,
  });

  return data;
}

export async function listContractChangeOrders(projectId: string) {
  const { data, error } = await supabase
    .from('contract_change_orders')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function createContractChangeOrder(payload: {
  project_id: string;
  cco_number: string;
  title: string;
  description?: string;
  cco_type: 'ADDITION' | 'DEDUCTION' | 'MIXED';
  wbs_code?: string | null;
  delta_amount: number;
  base_version_no?: number;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const signedDelta =
    payload.cco_type === 'DEDUCTION'
      ? -Math.abs(Number(payload.delta_amount || 0))
      : Number(payload.delta_amount || 0);

  const { data, error } = await supabase
    .from('contract_change_orders')
    .insert({
      ...payload,
      delta_amount: signedDelta,
      requested_by: userRes?.user?.id || null,
      status: 'Draft',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: payload.project_id,
    tableName: 'contract_change_orders',
    action: 'INSERT',
    recordId: data.id,
    newData: { cco_number: payload.cco_number, delta_amount: signedDelta, title: payload.title },
  });

  return data;
}

export async function updateCcoStatus(
  ccoId: string,
  projectId: string,
  status: 'Submitted' | 'Approved' | 'Rejected'
) {
  const { error } = await supabase
    .from('contract_change_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ccoId)
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'contract_change_orders',
    action: status === 'Rejected' ? 'REJECT' : 'UPDATE',
    recordId: ccoId,
    newData: { status },
  });
}

export async function signCcoAndCreateRabVersion(params: {
  ccoId: string;
  projectId: string;
  signedDate?: string;
  signedDocUrl?: string | null;
}) {
  const { data, error } = await supabase.rpc('rpc_sign_cco_and_create_rab_version', {
    p_cco_id: params.ccoId,
    p_signed_date: params.signedDate || new Date().toISOString().split('T')[0],
    p_signed_doc_url: params.signedDocUrl || null,
  });

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: params.projectId,
    tableName: 'contract_change_orders',
    action: 'APPROVE',
    recordId: params.ccoId,
    newData: data as any,
  });

  return data;
}

export async function listUnapprovedVariationWork(projectId: string) {
  const { data, error } = await supabase
    .from('v_unapproved_variation_work')
    .select('*')
    .eq('project_id', projectId)
    .order('incurred_date', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    console.warn('v_unapproved_variation_work belum tersedia:', error.message);
    return [];
  }
  return data || [];
}
