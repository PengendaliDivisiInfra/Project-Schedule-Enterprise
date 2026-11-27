// lib/services/hse-workforce.service.ts
import { supabase } from '@/lib/supabase';
import { recordAuditEvent } from '@/lib/services/logs.service';
import {
  evaluateHseComplianceGate,
  type HseGateEvaluation,
} from '@/lib/utils/hse-workforce-controls';

// ==========================================
// 1. HSE WORK PERMITS & JSA COMPLIANCE GATE
// ==========================================
export async function listHseWorkPermits(projectId: string) {
  const { data, error } = await supabase
    .from('hse_work_permits')
    .select('*')
    .eq('project_id', projectId)
    .order('valid_until', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function createHseWorkPermit(payload: {
  project_id: string;
  wbs_code?: string | null;
  permit_type: 'JSA' | 'WORK_PERMIT' | 'ZERO_ACCIDENT';
  permit_number: string;
  work_title: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  valid_from: string;
  valid_until: string;
  pic_name?: string;
  hse_officer_name?: string;
  document_url?: string | null;
  notes?: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('hse_work_permits')
    .insert({
      ...payload,
      wbs_code: payload.wbs_code || null,
      created_by: userRes?.user?.id || null,
      status: 'Active',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: payload.project_id,
    tableName: 'hse_work_permits',
    action: 'INSERT',
    recordId: data.id,
    newData: {
      permit_type: payload.permit_type,
      permit_number: payload.permit_number,
      wbs_code: payload.wbs_code || null,
      valid_from: payload.valid_from,
      valid_until: payload.valid_until,
    },
  });

  return data;
}

export async function updateHseWorkPermitStatus(
  id: string,
  projectId: string,
  status: 'Active' | 'Expired' | 'Revoked'
) {
  const { error } = await supabase
    .from('hse_work_permits')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'hse_work_permits',
    action: 'UPDATE',
    recordId: id,
    newData: { status },
  });
}

export async function toggleWbsHighRisk(
  taskId: string,
  projectId: string,
  isHighRisk: boolean,
  riskCategory?: string
) {
  const { error } = await supabase
    .from('wbs_tasks')
    .update({
      is_high_risk: isHighRisk,
      risk_category: isHighRisk ? riskCategory || 'Pekerjaan Berisiko Tinggi' : null,
    })
    .eq('id', taskId)
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);
}

export async function checkHseComplianceGateForTask(params: {
  projectId: string;
  wbsCode?: string | null;
  isHighRisk: boolean;
  recordDate: string;
}): Promise<HseGateEvaluation> {
  if (!params.isHighRisk) {
    return evaluateHseComplianceGate({
      isHighRisk: false,
      wbsCode: params.wbsCode,
      recordDate: params.recordDate,
      permits: [],
    });
  }

  const permits = await listHseWorkPermits(params.projectId);
  return evaluateHseComplianceGate({
    isHighRisk: true,
    wbsCode: params.wbsCode,
    recordDate: params.recordDate,
    permits,
  });
}

// ==========================================
// 2. ANTI-GHOST WORKERS (CROSS-PROJECT NIK GUARD)
// ==========================================
export async function checkGhostWorkerConflict(
  employeeId: string,
  attendanceDate: string
): Promise<{
  has_conflict: boolean;
  nik?: string;
  employee_name?: string;
  conflict_project_name?: string;
}> {
  const { data, error } = await supabase.rpc('rpc_check_ghost_worker_conflict', {
    p_employee_id: employeeId,
    p_attendance_date: attendanceDate,
  });

  if (error) {
    if (error.code === '42883' || String(error.message || '').includes('rpc_check_ghost_worker_conflict')) {
      return { has_conflict: false };
    }
    throw new Error(error.message);
  }

  return (data as any) || { has_conflict: false };
}

export async function listCrossProjectNikOverlaps() {
  const { data, error } = await supabase
    .from('v_cross_project_nik_audit')
    .select('*');

  if (error) {
    if (error.code === '42P01') return [];
    return [];
  }
  return data || [];
}
