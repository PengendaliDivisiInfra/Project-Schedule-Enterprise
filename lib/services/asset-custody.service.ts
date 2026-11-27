// lib/services/asset-custody.service.ts
import { supabase } from '@/lib/supabase';
import { recordAuditEvent } from '@/lib/services/logs.service';

export async function listRentalHealth(projectId: string) {
  const { data, error } = await supabase
    .from('v_equipment_rental_health')
    .select('*')
    .eq('project_id', projectId)
    .order('days_to_expiry', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    console.warn('v_equipment_rental_health belum tersedia:', error.message);
    return [];
  }
  return (data || []).map((row: any) => ({
    ...row,
    days_to_expiry: Number(row.days_to_expiry ?? 0),
    estimated_daily_burn: Number(row.estimated_daily_burn || 0),
    accrued_days: Number(row.accrued_days || 0),
    total_accrued_amount: Number(row.total_accrued_amount || 0),
  }));
}

export async function postDailyRentalAccrual(projectId: string, accrualDate?: string) {
  const targetDate = accrualDate || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.rpc('rpc_post_daily_rental_accrual', {
    p_project_id: projectId,
    p_accrual_date: targetDate,
  });

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'equipment_rental_accruals',
    action: 'INSERT',
    newData: data as any,
  });

  return data as {
    accrual_date: string;
    posted_contracts: number;
    total_accrued_amount: number;
  };
}

export async function listProjectAssetUnits(projectId: string) {
  const { data, error } = await supabase
    .from('equipment_units')
    .select('*, equipment_categories(name)')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('unit_code');

  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateUnitAssetTagAndCustodian(
  unitId: string,
  projectId: string,
  payload: {
    asset_tag?: string;
    ownership_type?: 'COMPANY_OWNED' | 'RENTED';
    custodian_name?: string;
    condition_status?: 'GOOD' | 'MINOR_DAMAGE' | 'BROKEN' | 'MAINTENANCE';
  }
) {
  const { error } = await supabase
    .from('equipment_units')
    .update(payload)
    .eq('id', unitId)
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);
}

export async function listAssetCustodyTransfers(projectId: string) {
  const { data, error } = await supabase
    .from('asset_custody_transfers')
    .select(`
      *,
      unit:equipment_units(unit_code, asset_tag, equipment_categories(name)),
      from_project:projects!asset_custody_transfers_from_project_id_fkey(name),
      to_project:projects!asset_custody_transfers_to_project_id_fkey(name)
    `)
    .or(`from_project_id.eq.${projectId},to_project_id.eq.${projectId}`)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    const fallback = await supabase
      .from('asset_custody_transfers')
      .select('*')
      .or(`from_project_id.eq.${projectId},to_project_id.eq.${projectId}`)
      .order('created_at', { ascending: false });
    return fallback.data || [];
  }
  return data || [];
}

export async function createAssetCustodyTransfer(payload: {
  transfer_number: string;
  unit_id: string;
  asset_tag: string;
  from_project_id: string;
  to_project_id: string;
  from_custodian_name?: string;
  to_custodian_name: string;
  condition_at_handover: string;
  handover_notes?: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('asset_custody_transfers')
    .insert({
      ...payload,
      requested_by: userRes?.user?.id || null,
      status: 'Pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId: payload.from_project_id,
    tableName: 'asset_custody_transfers',
    action: 'INSERT',
    recordId: data.id,
    newData: {
      transfer_number: payload.transfer_number,
      asset_tag: payload.asset_tag,
      to_project_id: payload.to_project_id,
      to_custodian_name: payload.to_custodian_name,
    },
  });

  return data;
}

export async function acceptAssetCustodyTransfer(transferId: string, projectId: string) {
  const { data, error } = await supabase.rpc('rpc_accept_asset_custody_transfer', {
    p_transfer_id: transferId,
  });

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'asset_custody_transfers',
    action: 'APPROVE',
    recordId: transferId,
    newData: data as any,
  });

  return data;
}
