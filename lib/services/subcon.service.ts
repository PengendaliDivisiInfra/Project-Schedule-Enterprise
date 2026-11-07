import { supabase } from '@/lib/supabase';
import { 
  Subcontractor, SubcontractorContract, SubcontractorPayment, 
  SubcontractorAddendum, AddendumItemChange, BAPPData, BPUTKData, BPUTKItem
} from '@/lib/types/subcon';

export async function listSubcontractors(projectId: string) {
  const { data, error } = await supabase.from('subcontractors').select('*').eq('project_id', projectId).eq('is_active', true).order('company_name');
  if (error) throw new Error(error.message);
  return data as Subcontractor[];
}

export async function createSubcontractor(payload: Partial<Subcontractor>) {
  const { data, error } = await supabase.from('subcontractors').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteSubcontractor(id: string) {
  const { error } = await supabase.from('subcontractors').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listSPK(projectId: string) {
  const { data, error } = await supabase
    .from('subcontractor_contracts')
    .select(`
      *,
      subcontractors ( company_name, bank_name, bank_account ),
      subcontractor_payments ( amount, payment_type, status ),
      subcontractor_addendums ( amount )
    `)
    .eq('project_id', projectId)
    .neq('status', 'Void')
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  
  return data.map((d: any) => {
    const total_paid = d.subcontractor_payments
      ?.filter((p: any) => p.status === 'Paid' || p.status === 'Approved')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
      
    const total_kasbon = d.subcontractor_payments
      ?.filter((p: any) => p.payment_type === 'Kasbon' && (p.status === 'Paid' || p.status === 'Approved'))
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
      
    const total_addendum = d.subcontractor_addendums?.reduce((sum: number, a: any) => sum + Number(a.amount), 0) || 0;
    
    return {
      ...d,
      subcontractor_name: d.subcontractors?.company_name,
      bank_name: d.subcontractors?.bank_name,
      bank_account: d.subcontractors?.bank_account,
      total_paid,
      total_kasbon,
      total_addendum,
      final_contract_value: d.contract_value
    };
  }) as any[];
}

export async function createSPK(payload: Partial<SubcontractorContract>) {
  const { data, error } = await supabase.from('subcontractor_contracts').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSPK(id: string, payload: Partial<SubcontractorContract>) {
  const { data, error } = await supabase.from('subcontractor_contracts').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteSPK(id: string) {
  const { error } = await supabase.from('subcontractor_contracts').update({ status: 'Void' }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getSPKItems(contractId: string) {
  const { data, error } = await supabase
    .from('subcontractor_spk_items')
    .select('*')
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createAddendum(payload: {
  contract_id: string;
  addendum_no: number;
  title: string;
  description: string;
  amount: number;
  new_contract_value: number;
  tax_mode: string; // TAMBAHAN BARU
  items: AddendumItemChange[];
}) {
  const { data, error } = await supabase.rpc('rpc_create_addendum', {
    p_contract_id: payload.contract_id,
    p_addendum_no: payload.addendum_no,
    p_title: payload.title,
    p_description: payload.description,
    p_amount_diff: payload.amount,
    p_new_contract_value: payload.new_contract_value,
    p_tax_mode: payload.tax_mode, // TAMBAHAN BARU
    p_items: payload.items
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getSPKHistory(contractId: string) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('table_name', 'subcontractor_contracts')
    .eq('record_id', contractId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function paySubcontractor(contractId: string, payload: { 
  payment_number: string; 
  payment_date: string; 
  amount: number; 
  description?: string;
  payment_type: 'Kasbon' | 'Opname' | 'DP';
  progress_pct: number;
  ppn_amount: number;
  pph_amount: number;
  category?: string; 
  payment_method?: string;
}) {
  const { data, error } = await supabase.rpc('rpc_pay_subcontractor', {
    p_contract_id: contractId,
    p_payment_number: payload.payment_number,
    p_payment_date: payload.payment_date,
    p_amount: payload.amount,
    p_description: payload.description,
    p_payment_type: payload.payment_type,
    p_progress_pct: payload.progress_pct,
    p_ppn_amount: payload.ppn_amount,
    p_pph_amount: payload.pph_amount,
    p_category: payload.category || null,
    p_payment_method: payload.payment_method || null
  });
  if (error) throw new Error(error.message);
  return data;
}

// ===== FUNGSI BAPP (UPGRADE) =====
export async function getBAPPData(contractId: string, startDate: string, endDate: string): Promise<BAPPData> {
  // 1. Ambil Data Kontrak & Proyek
  const { data: contract, error: cError } = await supabase
    .from('subcontractor_contracts')
    .select(`
      id, spk_number, work_description, contract_value, retention_pct, ppn_pct, pph_pct, tax_mode,
      subcontractors ( company_name, address, contact_person ),
      projects ( name, location, company_name, contractor_address, contractor_pic_name, contractor_pic_title, logo_url )
    `)
    .eq('id', contractId)
    .single();
  if (cError) throw new Error(cError.message);

  // 2. Auto-Fetch No. BAOP (Cari BAOP yang periodenya overlap)
  const { data: baopData } = await supabase
    .from('baop_documents')
    .select('baop_number')
    .eq('contract_id', contractId)
    .lte('period_start', endDate)
    .gte('period_end', startDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Auto-Fetch Nilai DP (Uang Muka) dari History Pembayaran
  const { data: dpData } = await supabase
    .from('subcontractor_payments')
    .select('amount')
    .eq('contract_id', contractId)
    .or('payment_type.eq.DP,description.ilike.%uang muka%,description.ilike.%dp%')
    .lte('payment_date', endDate);
    
  const nilaiDP = dpData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  // 4. Ambil Opname dalam Periode
  const { data: opnames, error: oError } = await supabase
    .from('subcon_opnames')
    .select(`id, opname_date, volume, price, total, subcontractor_spk_items ( description, unit, volume )`)
    .eq('contract_id', contractId)
    .gte('opname_date', startDate)
    .lte('opname_date', endDate)
    .order('opname_date', { ascending: true });
  if (oError) throw new Error(oError.message);

  // 5. Ambil Total Opname S/D Saat Ini (Akumulasi)
  const { data: allOpnames } = await supabase
    .from('subcon_opnames')
    .select('total')
    .eq('contract_id', contractId)
    .lte('opname_date', endDate);
  const totalOpnameSdIni = allOpnames?.reduce((sum, o) => sum + Number(o.total), 0) || 0;

  // 6. Ambil Data Kasbon, K3, Alat, DLL (dari subcon_financial_logs)
  const { data: financialLogs } = await supabase
    .from('subcon_financial_logs')
    .select('*')
    .eq('contract_id', contractId)
    .lte('log_date', endDate);

  const kasbons = financialLogs?.filter(f => f.type === 'KASBON') || [];
  const potongan = financialLogs?.filter(f => f.type === 'POTONGAN') || [];
  
  const totalKasbon = kasbons.reduce((sum, k) => sum + Number(k.amount), 0);
  const totalPotongan = potongan.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    contract,
    opnames: opnames || [],
    kasbons,
    potongan,
    totalOpnameSdIni,
    totalKasbon,
    totalPotongan,
    baop_number: baopData?.baop_number || null,
    nilaiDP: nilaiDP
  };
}

export async function saveBAPPDocument(payload: {
  project_id: string;
  contract_id: string;
  bapp_number: string;
  period_start: string;
  period_end: string;
  total_value: number;
  tax_mode: string;
  nilai_dpp: number;
  nilai_ppn: number;
  nilai_pph: number;
  signatures: any[];
}) {
  const { data, error } = await supabase.from('bapp_documents').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBAPPHistory(projectId: string) {
  const { data, error } = await supabase
    .from('bapp_documents')
    .select(`
      *,
      subcontractor_contracts ( spk_number, subcontractors ( company_name ) )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBAPPDocument(id: string) {
  const { error } = await supabase.from('bapp_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ===== FUNGSI BAOP =====
export async function getBAOPData(contractId: string, startDate: string, endDate: string) {
  const { data: contract, error: cError } = await supabase
    .from('subcontractor_contracts')
    .select(`
      id, spk_number, work_description, contract_value,
      subcontractors ( company_name, address, contact_person ),
      projects ( name, location, company_name, contractor_address, contractor_pic_name, contractor_pic_title, logo_url, contract_number )
    `)
    .eq('id', contractId)
    .single();
    
  if (cError) throw new Error(cError.message);

  const { data: opnames, error: oError } = await supabase
    .from('subcon_opnames')
    .select(`
      id, opname_date, volume, price, total,
      subcontractor_spk_items ( description, unit, volume )
    `)
    .eq('contract_id', contractId)
    .gte('opname_date', startDate)
    .lte('opname_date', endDate)
    .order('opname_date', { ascending: true });

  if (oError) throw new Error(oError.message);

  return { contract, opnames: opnames || [] };
}

export async function saveBAOPDocument(payload: {
  project_id: string;
  contract_id: string;
  baop_number: string;
  period_start: string;
  period_end: string;
  total_value: number;
}) {
  const { data, error } = await supabase.from('baop_documents').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBAOPHistory(projectId: string) {
  const { data, error } = await supabase
    .from('baop_documents')
    .select(`
      *,
      subcontractor_contracts ( spk_number, subcontractors ( company_name ) )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBAOPDocument(id: string) {
  const { error } = await supabase.from('baop_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ===== FUNGSI BPUTK DATA & HISTORY =====
export async function getBPUTKData(contractId: string, startDate: string, endDate: string): Promise<BPUTKData> {
  const { data: contract, error: cError } = await supabase
    .from('subcontractor_contracts')
    .select(`
      id, spk_number, work_description, contract_value, ppn_pct, pph_pct, retention_pct, tax_mode,
      subcontractors ( company_name, contact_person ),
      projects ( name, location, company_name, contractor_address, logo_url )
    `)
    .eq('id', contractId)
    .single();
  if (cError) throw new Error(cError.message);

  const { data: spkItems, error: iError } = await supabase
    .from('subcontractor_spk_items')
    .select('id, description, unit, volume, unit_price')
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (iError) throw new Error(iError.message);

  const { data: allOpnames, error: oError } = await supabase
    .from('subcon_opnames')
    .select('item_id, volume, total, opname_date')
    .eq('contract_id', contractId)
    .lte('opname_date', endDate);
  if (oError) throw new Error(oError.message);

  const { data: financialLogs } = await supabase
    .from('subcon_financial_logs')
    .select('type, amount')
    .eq('contract_id', contractId)
    .lte('log_date', endDate);

  const kasbons = financialLogs?.filter(f => f.type === 'KASBON') || [];
  const potongan = financialLogs?.filter(f => f.type === 'POTONGAN') || [];
  const totalKasbon = kasbons.reduce((sum, k) => sum + Number(k.amount), 0);
  const totalPotongan = potongan.reduce((sum, p) => sum + Number(p.amount), 0);

  let totalKontrak = 0;
  let totalNilaiLalu = 0;
  let totalNilaiSaatIni = 0;
  let totalNilaiSd = 0;
  let totalNilaiSisa = 0;

  const items: BPUTKItem[] = (spkItems || []).map((item) => {
    const volKontrak = Number(item.volume);
    const hargaSatuan = Number(item.unit_price);
    const jumlahKontrak = volKontrak * hargaSatuan;
    totalKontrak += jumlahKontrak;

    const itemOpnames = allOpnames?.filter(op => op.item_id === item.id) || [];
    
    const volLalu = itemOpnames
      .filter(op => op.opname_date < startDate)
      .reduce((sum, op) => sum + Number(op.volume), 0);
      
    const volSaatIni = itemOpnames
      .filter(op => op.opname_date >= startDate && op.opname_date <= endDate)
      .reduce((sum, op) => sum + Number(op.volume), 0);
      
    const volSd = volLalu + volSaatIni;
    const volSisa = volKontrak - volSd;

    const nilaiLalu = volLalu * hargaSatuan;
    const nilaiSaatIni = volSaatIni * hargaSatuan;
    const nilaiSd = volSd * hargaSatuan;
    const nilaiSisa = volSisa * hargaSatuan;

    totalNilaiLalu += nilaiLalu;
    totalNilaiSaatIni += nilaiSaatIni;
    totalNilaiSd += nilaiSd;
    totalNilaiSisa += nilaiSisa;

    return {
      id: item.id,
      description: item.description,
      unit: item.unit,
      volKontrak,
      hargaSatuan,
      jumlahKontrak,
      bobot: 0, 
      volLalu,
      nilaiLalu,
      volSaatIni,
      nilaiSaatIni,
      volSd,
      nilaiSd,
      volSisa,
      nilaiSisa
    };
  });

  items.forEach(item => {
    item.bobot = totalKontrak > 0 ? (item.jumlahKontrak / totalKontrak) * 100 : 0;
  });

  return {
    contract,
    items,
    totalKontrak,
    totalBobot: 100,
    totalNilaiLalu,
    totalNilaiSaatIni,
    totalNilaiSd,
    totalNilaiSisa,
    totalKasbon,
    totalPotongan
  };
}

export async function saveBPUTKDocument(payload: {
  project_id: string;
  contract_id: string;
  bputk_number: string;
  period_start: string;
  period_end: string;
  total_value: number;
  tax_mode: string;
  nilai_dpp: number;
  nilai_ppn: number;
  nilai_pph: number;
  signatures: any[];
}) {
  const { data, error } = await supabase.from('bputk_documents').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBPUTKHistory(projectId: string) {
  const { data, error } = await supabase
    .from('bputk_documents')
    .select(`
      *,
      subcontractor_contracts ( spk_number, subcontractors ( company_name ) )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBPUTKDocument(id: string) {
  const { error } = await supabase.from('bputk_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ===== FUNGSI INLINE EDIT & SIMPAN PROGRESS =====
export async function checkOverlappingOpnames(contractId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('subcon_opnames')
    .select('id')
    .eq('contract_id', contractId)
    .gte('opname_date', startDate)
    .lte('opname_date', endDate)
    .limit(1);

  if (error) throw new Error(error.message);
  return data && data.length > 0;
}

export async function saveOpnameProgress(contractId: string, opnameDate: string, items: { item_id: string, volume: number, price: number }[]) {
  const itemIds = items.map(i => i.item_id);
  
  const { error: delError } = await supabase
    .from('subcon_opnames')
    .delete()
    .eq('contract_id', contractId)
    .eq('opname_date', opnameDate)
    .in('item_id', itemIds);

  if (delError) throw new Error(delError.message);

  const payloads = items
    .filter(i => i.volume > 0)
    .map(i => ({
      contract_id: contractId,
      item_id: i.item_id,
      opname_date: opnameDate,
      volume: i.volume,
      price: i.price
    }));

  if (payloads.length > 0) {
    const { error: insError } = await supabase.from('subcon_opnames').insert(payloads);
    if (insError) throw new Error(insError.message);
  }

  return true;
}

// ===== FUNGSI PENGAJUAN KASBON =====
export async function createKasbonRequest(payload: {
  project_id: string;
  contract_id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  description: string;
  payment_method: string;
  bank_account: string;
  signatures: any[];
}) {
  const { data, error } = await supabase.from('subcontractor_payments').insert([{
    project_id: payload.project_id,
    contract_id: payload.contract_id,
    payment_number: payload.payment_number,
    payment_date: payload.payment_date,
    amount: payload.amount,
    description: payload.description,
    payment_type: 'Kasbon',
    progress_pct: 0,
    status: 'Pending',
    signatures: payload.signatures
  }]).select().single();
  
  if (error) throw new Error(error.message);
  return data;
}

export async function getAllKasbonHistory(projectId: string) {
  const { data, error } = await supabase
    .from('subcontractor_payments')
    .select(`
      *,
      subcontractor_contracts ( subcontractors ( company_name ) )
    `)
    .eq('project_id', projectId)
    .eq('payment_type', 'Kasbon')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Gagal load riwayat:", error);
    return [];
  }
  return data || [];
}

// ===== FUNGSI POIN 3: APPROVAL WORKFLOW =====
export async function getPendingPayments(projectId: string) {
  const { data, error } = await supabase
    .from('subcontractor_payments')
    .select(`
      *,
      subcontractor_contracts ( spk_number, subcontractors ( company_name ) )
    `)
    .eq('project_id', projectId)
    .eq('status', 'Pending')
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePaymentStatus(paymentId: string, status: 'Approved' | 'Paid') {
  const { data, error } = await supabase
    .from('subcontractor_payments')
    .update({ status })
    .eq('id', paymentId)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  return data;
}