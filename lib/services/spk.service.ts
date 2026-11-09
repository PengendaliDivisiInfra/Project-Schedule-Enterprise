// lib/services/spk.service.ts
import { supabase } from '@/lib/supabase'; // <-- PERBAIKAN IMPORT DI SINI
import { roundSPK_Thousands } from '../utils/spk-helper';

export const spkService = {
  // Ambil template pasal
  async getTemplates() {
    const { data, error } = await supabase.from('spk_templates').select('*').order('order_index');
    if (error) throw error;
    return data;
  },

  // Simpan SPK Baru (Status DRAFT)
  async createSPK(payload: any) {
    // Hitung total & bulatkan
    const totalKotor = payload.bq_items.reduce((acc: number, item: any) => acc + item.subtotal, 0);
    const totalBulat = roundSPK_Thousands(totalKotor);

    const { data, error } = await supabase.from('subcontractor_contracts').insert({
      project_id: payload.project_id,
      subcontractor_id: payload.subcontractor_id,
      spk_number: payload.spk_number,
      work_description: payload.work_description,
      contract_value: totalBulat,
      retention_pct: payload.retention_pct,
      ppn_pct: payload.ppn_pct,
      pph_pct: payload.pph_pct,
      tax_mode: payload.tax_mode,
      status: 'DRAFT',
      bq_items: payload.bq_items,
      ktp_url: payload.ktp_url,
      signature_pihak_1: payload.signature_pihak_1,
      signature_pihak_2: payload.signature_pihak_2,
    }).select().single();

    if (error) throw error;
    return data;
  },

  // Issue SPK (Kunci Data / Snapshot)
  async issueSPK(id: string, templates: any[], projectData: any, subconData: any) {
    // Ambil data draft saat ini
    const { data: spk, error: fetchError } = await supabase.from('subcontractor_contracts').select('*').eq('id', id).single();
    if (fetchError || !spk) throw new Error("SPK tidak ditemukan.");
    if (spk.status !== 'DRAFT') throw new Error("Hanya SPK berstatus DRAFT yang bisa di-Issue.");

    // Ambil data user yang sedang login
    const { data: { user } } = await supabase.auth.getUser();

    // Buat Snapshot (Data Beku)
    const snapshot = {
      templates,
      project: projectData,
      subcontractor: subconData,
      generated_at: new Date().toISOString(),
      issued_by: user?.email || 'System'
    };

    const { data, error } = await supabase.from('subcontractor_contracts')
      .update({ status: 'ISSUED', spk_snapshot: snapshot })
      .eq('id', id).select().single();

    if (error) throw error;
    return data;
  },

  // Buat Addendum (Copy data lama ke dokumen baru)
  async createAddendum(oldSpkId: string, newSpkNumber: string) {
    const { data: oldSpk, error: fetchError } = await supabase.from('subcontractor_contracts').select('*').eq('id', oldSpkId).single();
    if (fetchError || !oldSpk) throw new Error("SPK Asal tidak ditemukan.");
    
    const newPayload = {
      ...oldSpk,
      id: undefined, // Biarkan DB generate UUID baru
      parent_spk_id: oldSpkId,
      spk_number: newSpkNumber,
      status: 'DRAFT',
      spk_snapshot: null, // Reset snapshot
      created_at: undefined,
      updated_at: undefined
    };

    const { data, error } = await supabase.from('subcontractor_contracts').insert(newPayload).select().single();
    if (error) throw error;
    return data;
  }
};