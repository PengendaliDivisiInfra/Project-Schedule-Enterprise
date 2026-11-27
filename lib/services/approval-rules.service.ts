// lib/services/approval-rules.service.ts
import { supabase } from '@/lib/supabase';
import type { ApprovalRuleRecord } from '@/lib/utils/budget-control';
import { recordAuditEvent } from '@/lib/services/logs.service';

export async function listApprovalRules(projectId?: string | null): Promise<ApprovalRuleRecord[]> {
  let query = supabase
    .from('approval_rules')
    .select('*')
    .order('document_type', { ascending: true })
    .order('priority', { ascending: true })
    .order('min_amount', { ascending: true });

  if (projectId) {
    query = query.or(`project_id.is.null,project_id.eq.${projectId}`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    ...row,
    min_amount: Number(row.min_amount || 0),
    max_amount: row.max_amount === null || row.max_amount === undefined ? null : Number(row.max_amount),
    approver_roles: Array.isArray(row.approver_roles) ? row.approver_roles : ['Project Manager'],
    priority: Number(row.priority ?? 100),
  }));
}

export async function upsertApprovalRule(
  rule: Partial<ApprovalRuleRecord> & {
    rule_name: string;
    document_type: ApprovalRuleRecord['document_type'];
    cost_category: string;
    min_amount: number;
    max_amount: number | null;
    approver_roles: string[];
  },
  auditProjectId?: string | null
) {
  const payload = {
    project_id: rule.project_id || null,
    rule_name: rule.rule_name.trim(),
    document_type: rule.document_type,
    cost_category: rule.cost_category || 'ALL',
    min_amount: Number(rule.min_amount) || 0,
    max_amount:
      rule.max_amount === null || rule.max_amount === undefined || String(rule.max_amount) === ''
        ? null
        : Number(rule.max_amount),
    approver_roles: rule.approver_roles.length > 0 ? rule.approver_roles : ['Project Manager'],
    require_mfa: rule.require_mfa !== false,
    is_active: rule.is_active !== false,
    priority: Number(rule.priority ?? 100),
    updated_at: new Date().toISOString(),
  };

  if (rule.id) {
    const { data, error } = await supabase
      .from('approval_rules')
      .update(payload)
      .eq('id', rule.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await recordAuditEvent({
      projectId: auditProjectId || rule.project_id || null,
      tableName: 'approval_rules',
      action: 'UPDATE',
      recordId: rule.id,
      newData: payload,
    });
    return data;
  } else {
    const { data, error } = await supabase
      .from('approval_rules')
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message);

    await recordAuditEvent({
      projectId: auditProjectId || rule.project_id || null,
      tableName: 'approval_rules',
      action: 'INSERT',
      recordId: data.id,
      newData: payload,
    });
    return data;
  }
}

export async function deleteApprovalRule(id: string, auditProjectId?: string | null) {
  const { error } = await supabase.from('approval_rules').delete().eq('id', id);
  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: auditProjectId || null,
    tableName: 'approval_rules',
    action: 'DELETE',
    recordId: id,
    oldData: { id },
  });
}

export async function processTieredApproval(params: {
  recordId: string;
  projectId: string;
  decision: 'Approved' | 'Rejected';
  reason?: string | null;
}) {
  const { data, error } = await supabase.rpc('rpc_process_tiered_approval', {
    p_record_id: params.recordId,
    p_decision: params.decision.toUpperCase(),
    p_reason: params.reason || null,
  });

  if (error) {
    if (String(error.message || '').includes('FORBIDDEN_TIER')) {
      throw new Error(error.message.replace(/^FORBIDDEN_TIER:\s*/i, ''));
    }
    if (error.code === '42883' || String(error.message || '').includes('rpc_process_tiered_approval')) {
      const updatePayload: Record<string, any> = { approval_status: params.decision };
      if (params.reason) updatePayload.rejection_reason = params.reason;
      const { error: fbErr } = await supabase
        .from('cash_flows')
        .update(updatePayload)
        .eq('id', params.recordId)
        .eq('project_id', params.projectId);
      if (fbErr) throw new Error(fbErr.message);
      return {
        id: params.recordId,
        approval_status: params.decision,
        current_approval_step: 1,
        required_approval_steps: 1,
        next_required_role: null,
      };
    }
    throw new Error(error.message);
  }

  return data as {
    id: string;
    approval_status: 'Pending' | 'Approved' | 'Rejected';
    current_approval_step: number;
    required_approval_steps: number;
    next_required_role: string | null;
  };
}
