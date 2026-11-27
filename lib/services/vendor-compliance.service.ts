// lib/services/vendor-compliance.service.ts
import { supabase } from '@/lib/supabase';
import { recordAuditEvent } from '@/lib/services/logs.service';
import {
  evaluateVendorCompliance,
  calculateVendorScorecard,
} from '@/lib/utils/vendor-equipment-controls';

export async function listCentralizedVendors(projectId?: string | null) {
  let query = supabase.from('vendors').select('*').eq('is_active', true).order('name');
  if (projectId) {
    query = query.or(`project_id.is.null,is_centralized.eq.true,project_id.eq.${projectId}`);
  }

  let { data, error } = await query;
  if (error && (error.code === '42703' || String(error.message || '').includes('is_centralized'))) {
    const fallback = projectId
      ? await supabase.from('vendors').select('*').eq('project_id', projectId).eq('is_active', true).order('name')
      : await supabase.from('vendors').select('*').eq('is_active', true).order('name');
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);

  // Ambil ringkasan skor lintas proyek
  const { data: scoreData } = await supabase
    .from('v_vendor_scorecard_summary')
    .select('*')
    .eq('entity_type', 'VENDOR');

  const scoreMap = new Map<string, any>();
  (scoreData || []).forEach((s: any) => {
    if (s.entity_id) scoreMap.set(s.entity_id, s);
  });

  return (data || []).map((v: any) => {
    const sc = scoreMap.get(v.id);
    const compliance = evaluateVendorCompliance({
      name: v.name,
      isBlacklisted: v.is_blacklisted,
      blacklistReason: v.blacklist_reason,
      npwpNumber: v.npwp_number,
      pkpStatus: v.pkp_status,
      pkpExpiryDate: v.pkp_expiry_date,
      legalExpiryDate: v.legal_expiry_date,
    });
    return {
      ...v,
      compliance,
      avg_score: sc ? Number(sc.avg_overall_score) : null,
      score_grade: sc?.avg_grade || null,
      evaluation_count: sc ? Number(sc.evaluation_count) : 0,
    };
  });
}

export async function assertVendorCompliantForPo(vendorId: string): Promise<void> {
  if (!vendorId) return;
  const { data: v, error } = await supabase
    .from('vendors')
    .select('id, name, is_blacklisted, blacklist_reason, npwp_number, pkp_status, pkp_expiry_date, legal_expiry_date')
    .eq('id', vendorId)
    .maybeSingle();

  if (error) {
    if (error.code === '42703') return; // Kolom belum dimigrasi
    throw new Error(error.message);
  }
  if (!v) return;

  const check = evaluateVendorCompliance({
    name: v.name,
    isBlacklisted: (v as any).is_blacklisted,
    blacklistReason: (v as any).blacklist_reason,
    npwpNumber: (v as any).npwp_number,
    pkpStatus: (v as any).pkp_status,
    pkpExpiryDate: (v as any).pkp_expiry_date,
    legalExpiryDate: (v as any).legal_expiry_date,
  });

  if (!check.allowed) {
    throw new Error(check.reasons.join(' '));
  }
}

export async function assertSubconCompliantForSpk(subcontractorId: string): Promise<void> {
  if (!subcontractorId) return;
  const { data: s, error } = await supabase
    .from('subcontractors')
    .select('id, company_name, is_blacklisted, blacklist_reason, npwp_number, pkp_status, pkp_expiry_date, legal_expiry_date')
    .eq('id', subcontractorId)
    .maybeSingle();

  if (error) {
    if (error.code === '42703') return;
    throw new Error(error.message);
  }
  if (!s) return;

  const check = evaluateVendorCompliance({
    name: s.company_name,
    isBlacklisted: (s as any).is_blacklisted,
    blacklistReason: (s as any).blacklist_reason,
    npwpNumber: (s as any).npwp_number,
    pkpStatus: (s as any).pkp_status,
    pkpExpiryDate: (s as any).pkp_expiry_date,
    legalExpiryDate: (s as any).legal_expiry_date,
  });

  if (!check.allowed) {
    throw new Error(check.reasons.join(' '));
  }
}

export async function toggleVendorBlacklist(params: {
  vendorId: string;
  projectId?: string | null;
  blacklist: boolean;
  reason?: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const payload = params.blacklist
    ? {
        is_blacklisted: true,
        blacklist_reason: params.reason?.trim() || 'Diblokir oleh Central Procurement',
        blacklisted_at: new Date().toISOString(),
        blacklisted_by: userRes?.user?.id || null,
      }
    : {
        is_blacklisted: false,
        blacklist_reason: null,
        blacklisted_at: null,
        blacklisted_by: null,
      };

  const { error } = await supabase.from('vendors').update(payload).eq('id', params.vendorId);
  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: params.projectId || null,
    tableName: 'vendors',
    action: params.blacklist ? 'REJECT' : 'APPROVE',
    recordId: params.vendorId,
    newData: payload,
  });
}

export async function updateVendorComplianceDocs(params: {
  vendorId: string;
  projectId?: string | null;
  vendor_code?: string | null;
  npwp_number?: string | null;
  pkp_status?: 'PKP' | 'NON_PKP';
  pkp_expiry_date?: string | null;
  legal_expiry_date?: string | null;
  is_centralized?: boolean;
}) {
  const { vendorId, projectId, ...fields } = params;
  const { error } = await supabase.from('vendors').update(fields).eq('id', vendorId);
  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: projectId || null,
    tableName: 'vendors',
    action: 'UPDATE',
    recordId: vendorId,
    newData: fields,
  });
}

export async function listVendorScorecards() {
  const { data, error } = await supabase
    .from('vendor_scorecards')
    .select('*, project:projects(name)')
    .order('evaluation_date', { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function createVendorScorecard(params: {
  project_id: string;
  entity_type: 'VENDOR' | 'SUBCONTRACTOR';
  vendor_id?: string | null;
  subcontractor_id?: string | null;
  vendor_name: string;
  delivery_score: number;
  quality_score: number;
  safety_score: number;
  evaluation_date?: string;
  notes?: string;
}) {
  const calc = calculateVendorScorecard({
    deliveryScore: params.delivery_score,
    qualityScore: params.quality_score,
    safetyScore: params.safety_score,
  });

  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('vendor_scorecards')
    .insert({
      project_id: params.project_id,
      entity_type: params.entity_type,
      vendor_id: params.vendor_id || null,
      subcontractor_id: params.subcontractor_id || null,
      vendor_name: params.vendor_name,
      delivery_score: calc.deliveryScore,
      quality_score: calc.qualityScore,
      safety_score: calc.safetyScore,
      overall_score: calc.overallScore,
      grade: calc.grade,
      recommendation: calc.recommendation,
      evaluation_date: params.evaluation_date || new Date().toISOString().split('T')[0],
      evaluated_by: userRes?.user?.id || null,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: params.project_id,
    tableName: 'vendor_scorecards',
    action: 'INSERT',
    recordId: data.id,
    newData: {
      vendor_name: params.vendor_name,
      overall_score: calc.overallScore,
      grade: calc.grade,
      recommendation: calc.recommendation,
    },
  });

  return data;
}
