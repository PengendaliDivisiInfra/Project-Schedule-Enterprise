// lib/services/budget-control.service.ts
import { supabase } from '@/lib/supabase';
import { recordAuditEvent } from '@/lib/services/logs.service';

export interface ProjectBudgetSummaryRow {
  project_id: string;
  project_name: string;
  budget_hard_stop: boolean;
  pagu_rab: number;
  committed_po: number;
  committed_spk: number;
  committed_pending_cash: number;
  committed_budget: number;
  actual_cost: number;
  available_budget: number;
}

export interface WbsBudget3LayerRow {
  task_id?: string;
  project_id: string;
  wbs_code: string;
  task_name: string;
  summary?: string;
  pagu_rab: number;
  committed_po: number;
  committed_spk: number;
  committed_pending_cash: number;
  committed_budget: number;
  actual_cost: number;
  available_budget: number;
}

export interface SubmitBudgetedCashFlowInput {
  project_id: string;
  type: 'IN' | 'OUT';
  category: string;
  description: string;
  amount: number;
  transaction_date: string;
  payment_method: string;
  vendor_or_ref?: string | null;
  wbs_code?: string | null;
  attachment_url?: string | null;
  overbudget_reason?: string | null;
}

export async function getProjectBudgetSummary(
  projectId: string
): Promise<ProjectBudgetSummaryRow | null> {
  const { data, error } = await supabase
    .from('v_project_budget_summary')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    console.warn('v_project_budget_summary belum tersedia:', error.message);
    return null;
  }

  if (!data) return null;
  return {
    ...data,
    pagu_rab: Number(data.pagu_rab || 0),
    committed_po: Number(data.committed_po || 0),
    committed_spk: Number(data.committed_spk || 0),
    committed_pending_cash: Number(data.committed_pending_cash || 0),
    committed_budget: Number(data.committed_budget || 0),
    actual_cost: Number(data.actual_cost || 0),
    available_budget: Number(data.available_budget || 0),
  };
}

export async function getWbsBudget3Layer(projectId: string): Promise<WbsBudget3LayerRow[]> {
  const { data, error } = await supabase
    .from('v_budget_3layer_wbs')
    .select('*')
    .eq('project_id', projectId)
    .order('wbs_code');

  if (!error && data) {
    return data.map((row: any) => ({
      task_id: row.task_id,
      project_id: row.project_id,
      wbs_code: row.wbs_code,
      task_name: row.task_name,
      summary: row.summary,
      pagu_rab: Number(row.pagu_rab || 0),
      committed_po: Number(row.committed_po || 0),
      committed_spk: Number(row.committed_spk || 0),
      committed_pending_cash: Number(row.committed_pending_cash || 0),
      committed_budget: Number(row.committed_budget || 0),
      actual_cost: Number(row.actual_cost || 0),
      available_budget: Number(row.available_budget || 0),
    }));
  }

  const { data: legacy } = await supabase
    .from('v_cost_control_wbs')
    .select('*')
    .eq('project_id', projectId)
    .order('wbs_code');

  return (legacy || []).map((row: any) => {
    const pagu = Number(row.pagu_anggaran_rap || 0);
    const actual = Number(row.total_pengeluaran_aktual || 0);
    return {
      project_id: projectId,
      wbs_code: row.wbs_code,
      task_name: row.task_name,
      pagu_rab: pagu,
      committed_po: 0,
      committed_spk: 0,
      committed_pending_cash: 0,
      committed_budget: 0,
      actual_cost: actual,
      available_budget: Number(row.sisa_anggaran_plafon ?? pagu - actual),
    };
  });
}

export async function submitBudgetedCashFlow(payload: SubmitBudgetedCashFlowInput) {
  const { data, error } = await supabase.rpc('rpc_submit_budgeted_cashflow', {
    p_project_id: payload.project_id,
    p_type: payload.type,
    p_category: payload.category,
    p_description: payload.description || '',
    p_amount: Number(payload.amount),
    p_transaction_date: payload.transaction_date,
    p_payment_method: payload.payment_method,
    p_vendor_or_ref: payload.vendor_or_ref || null,
    p_wbs_code: payload.wbs_code || null,
    p_attachment_url: payload.attachment_url || null,
    p_overbudget_reason: payload.overbudget_reason || null,
  });

  if (error) {
    if (String(error.message || '').includes('BUDGET_EXCEEDED')) {
      throw new Error(error.message.replace(/^BUDGET_EXCEEDED:\s*/i, ''));
    }
    if (String(error.message || '').includes('RING_FENCED_DEFICIT')) {
      throw new Error(error.message.replace(/^RING_FENCED_DEFICIT:\s*/i, ''));
    }
    if (error.code === '42883' || String(error.message || '').includes('rpc_submit_budgeted_cashflow')) {
      const { data: fallbackRow, error: fbErr } = await supabase
        .from('cash_flows')
        .insert([
          {
            ...payload,
            amount: Number(payload.amount),
            approval_status: 'Pending',
          },
        ])
        .select('id')
        .single();
      if (fbErr) throw new Error(fbErr.message);
      return { id: fallbackRow.id, approval_chain: ['Project Manager'], required_approval_steps: 1 };
    }
    throw new Error(error.message);
  }

  await recordAuditEvent({
    projectId: payload.project_id,
    tableName: 'cash_flows',
    action: 'INSERT',
    recordId: (data as any)?.id || null,
    newData: {
      type: payload.type,
      category: payload.category,
      amount: Number(payload.amount),
      wbs_code: payload.wbs_code || null,
      approval_chain: (data as any)?.approval_chain || null,
    },
  });

  return data;
}

export async function validatePoBudgetLock(
  projectId: string,
  wbsCode: string | null | undefined,
  grandTotal: number,
  costCategory: string = 'Material'
): Promise<{
  allowed: boolean;
  approval_chain: string[];
  required_approval_steps: number;
  available_budget?: number;
}> {
  const { data, error } = await supabase.rpc('rpc_validate_and_lock_po_budget', {
    p_project_id: projectId,
    p_wbs_code: wbsCode || null,
    p_grand_total: Number(grandTotal),
    p_cost_category: costCategory,
  });

  if (error) {
    if (String(error.message || '').includes('BUDGET_EXCEEDED')) {
      throw new Error(error.message.replace(/^BUDGET_EXCEEDED:\s*/i, ''));
    }
    if (error.code === '42883' || String(error.message || '').includes('rpc_validate_and_lock_po_budget')) {
      return {
        allowed: true,
        approval_chain: ['Project Manager'],
        required_approval_steps: 1,
      };
    }
    throw new Error(error.message);
  }

  return {
    allowed: Boolean((data as any)?.allowed ?? true),
    approval_chain: Array.isArray((data as any)?.approval_chain)
      ? (data as any).approval_chain
      : ['Project Manager'],
    required_approval_steps: Number((data as any)?.required_approval_steps || 1),
    available_budget: Number((data as any)?.available_budget ?? 0),
  };
}
