// lib/services/vendor-service.ts
import { supabase } from '../supabase';
import type { Vendor } from '@/types/purchase-order';

const TABLE = 'vendors';

export async function getVendors(projectId: string): Promise<Vendor[]> {
  // Ambil Master Vendor Terpusat (lintas proyek) + vendor khusus proyek aktif
  let { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .or(`project_id.is.null,is_centralized.eq.true,project_id.eq.${projectId}`)
    .eq('is_active', true)
    .order('name');

  if (error && (error.code === '42703' || String(error.message || '').includes('is_centralized'))) {
    const fallback = await supabase
      .from(TABLE)
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('name');
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  return (data || []) as Vendor[];
}

export async function createVendor(payload: Partial<Vendor>): Promise<Vendor> {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateVendor(id: string, payload: Partial<Vendor>): Promise<Vendor> {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// Soft Delete: Hanya menonaktifkan agar history PO tidak rusak
export async function deactivateVendor(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}
