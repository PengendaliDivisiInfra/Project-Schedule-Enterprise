import { supabase } from '@/lib/supabase';

export type BalanceItem = { awal: number; mutasi: number; akhir: number; };

export interface BalanceSheetResult {
  asOfDate: string;
  periodStart: string;
  project: any;
  summary: {
    contractValue: number;
    totalRAP: number;
    pocPercent: number;
    totalInvoiced: number;
    remainingContract: number;
  };
  assets: {
    kasBank: BalanceItem;
    piutangUsaha: BalanceItem;
    piutangRetensi: BalanceItem;
    pphDibayarDimuka: BalanceItem;
    asetKontrak: BalanceItem;
    persediaan: BalanceItem;
    uangMuka: BalanceItem;
    total: BalanceItem;
  };
  liabilitiesEquity: {
    utangUsaha: BalanceItem;
    utangSubkon: BalanceItem;
    biayaAkrual: BalanceItem;
    liabilitasKontrak: BalanceItem;
    utangRetensiSubkon: BalanceItem;
    rkPusat: BalanceItem;
    labaBerjalan: BalanceItem;
    total: BalanceItem;
  };
  isBalanced: boolean;
  variance: number;
}

export async function generateProjectBalanceSheet(projectId: string, startDate: string, endDate: string): Promise<BalanceSheetResult> {
  const safeProjectId = projectId.trim();

  // 1. Ambil Data Proyek
  const { data: project, error: projErr } = await supabase.from('projects').select('*').eq('id', safeProjectId).single();
  if (projErr || !project) throw new Error("Proyek tidak ditemukan atau ID tidak valid");

  // ==========================================
  // A. KALKULASI P&L (Untuk Laba Berjalan & Kontrak)
  // ==========================================
  const { data: contr } = await supabase.from('client_contracts').select('contract_value').eq('project_id', safeProjectId).eq('is_active', true).maybeSingle();
  const contractVal = contr?.contract_value || project?.contract_value || 0;

  const { data: poItemsData } = await supabase.from('purchase_order_items')
    .select(`received_qty, unit_price, purchase_orders!inner(project_id, status, kategori_akun)`)
    .eq('purchase_orders.project_id', safeProjectId)
    .neq('purchase_orders.status', 'Void')
    .gt('received_qty', 0);

  let poMaterial = 0, poAlat = 0, totalGrnValue = 0;
  (poItemsData || []).forEach((item: any) => {
    const amt = Number(item.received_qty) * Number(item.unit_price);
    totalGrnValue += amt;
    const poData = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders;
    if (poData?.kategori_akun === 'Alat') poAlat += amt; else poMaterial += amt;
  });

  const { data: subconData } = await supabase.from('subcontractor_payments').select('amount, payment_type, status, payment_date').eq('project_id', safeProjectId).in('status', ['Approved', 'Paid']).lte('payment_date', endDate);
  let totalSubconOpname = 0, unearnedKasbon = 0;
  (subconData || []).forEach((s: any) => {
    const amt = Number(s.amount || 0);
    if (s.payment_type === 'Kasbon' || s.payment_type === 'DP') unearnedKasbon += amt;
    else totalSubconOpname += amt;
  });

  const { data: actualCostsData } = await supabase.from('actual_costs').select('cost_amount, resource_type, recorded_at').eq('project_id', safeProjectId).lte('recorded_at', `${endDate}T23:59:59Z`);
  let accrualUpah = 0, accrualAlat = 0, accrualOperasional = 0;
  (actualCostsData || []).forEach((ac: any) => {
    const amt = Number(ac.cost_amount || 0);
    if (['Labor', 'Upah'].includes(ac.resource_type)) accrualUpah += amt;
    else if (['Equipment', 'Alat'].includes(ac.resource_type)) accrualAlat += amt;
    else accrualOperasional += amt;
  });

  const { data: cfData } = await supabase.from('cash_flows').select('amount, category, type, transaction_date').eq('project_id', safeProjectId).eq('approval_status', 'Approved').is('voided_at', null).lte('transaction_date', endDate);
  
  let cfUpah = 0, cfAlat = 0, cfOperasional = 0, cfDropingIn = 0, cfDropingOut = 0;
  let cfKasAwal = 0, cfKasAkhir = 0, cfOperationalIn = 0;
  let cfDropingInAwal = 0, cfDropingOutAwal = 0;
  
  (cfData || []).forEach((cf: any) => {
    const amt = Number(cf.amount || 0);
    const isIn = ['IN', 'Income'].includes(cf.type);
    const isFinancing = ['Droping', 'Pinjaman', 'Modal', 'Transfer Internal'].includes(cf.category);
    const isBeforePeriod = cf.transaction_date < startDate;
    
    const val = isIn ? amt : -amt;
    if (isBeforePeriod) cfKasAwal += val;
    cfKasAkhir += val;
    
    if (isIn) {
      if (isFinancing) {
        if (isBeforePeriod) cfDropingInAwal += amt;
        cfDropingIn += amt;
      } else {
        cfOperationalIn += amt; 
      }
    } else {
      if (['Upah'].includes(cf.category)) cfUpah += amt;
      else if (['Alat'].includes(cf.category)) cfAlat += amt;
      else if (['Operasional', 'Lainnya'].includes(cf.category)) cfOperasional += amt;

      if (isFinancing) {
        if (isBeforePeriod) cfDropingOutAwal += amt;
        cfDropingOut += amt;
      }
    }
  });

  const { data: invData } = await supabase.from('inventory_materials').select('stok_on_hand, master_hsd(harga_dasar)').eq('project_id', safeProjectId);
  let rawStockValue = 0;
  (invData || []).forEach((inv: any) => {
    const hsdData = Array.isArray(inv.master_hsd) ? inv.master_hsd[0] : inv.master_hsd;
    rawStockValue += (Number(inv.stok_on_hand || 0) * Number(hsdData?.harga_dasar || 0));
  });

  const recognizedStock = Math.min(rawStockValue, totalGrnValue);
  const totalUpah = accrualUpah + cfUpah;
  const totalAlat = accrualAlat + cfAlat;
  const totalOperasional = accrualOperasional + cfOperasional;

  const totalActualCostRaw = poMaterial + poAlat + totalSubconOpname + totalUpah + totalAlat;
  const stockToDeduct = poMaterial > 0 ? Math.min(poMaterial, rawStockValue) : 0;
  const qualifiedActualCost = Math.max(0, totalActualCostRaw - stockToDeduct - unearnedKasbon);

  const { data: wbsData } = await supabase.from('v_cost_control_wbs').select('pagu_anggaran_rap').eq('project_id', safeProjectId);
  const totalRAP = (wbsData || []).reduce((sum: number, w: any) => sum + Number(w.pagu_anggaran_rap || 0), 0);
  
  let pocPercent = 0;
  if (qualifiedActualCost > 0 && totalRAP > 0) pocPercent = Math.min(100, (qualifiedActualCost / totalRAP) * 100);
  else if (qualifiedActualCost > 0 && totalRAP === 0) pocPercent = Math.min(100, (qualifiedActualCost / contractVal) * 100);
  
  const revenueRecognized = Math.round((pocPercent / 100) * contractVal);
  const hppMaterial = poMaterial > 0 ? Math.max(0, poMaterial - rawStockValue) : 0;
  const totalHpp = hppMaterial + totalSubconOpname + totalAlat + totalUpah;
  const netProfit = (revenueRecognized - totalHpp) - totalOperasional;

  // ==========================================
  // B. KALKULASI NERACA DENGAN PERIODE
  // ==========================================
  const { data: termins } = await supabase.from('project_termins').select('*').eq('project_id', safeProjectId).not('sp2d_number', 'is', null).lte('created_at', `${endDate}T23:59:59Z`);
  
  // FIX BUG 1: Hitung Total Invoiced dan Total Invoiced Saldo Awal
  const totalInvoiced = (termins || []).reduce((sum: number, t: any) => sum + Number(t.gross_amount || 0), 0);
  const totalInvoicedAwal = (termins || []).filter((t: any) => t.created_at < startDate).reduce((sum: number, t: any) => sum + Number(t.gross_amount || 0), 0);

  const { data: invoices } = await supabase.from('client_invoices').select('*').eq('project_id', safeProjectId).neq('status', 'Void').lte('invoice_date', endDate);
  let piutangRetensiAkhir = 0, piutangPphAkhir = 0, piutangRetensiAwal = 0, piutangPphAwal = 0;
  
  if (invoices && invoices.length > 0) {
    (invoices || []).forEach((inv: any) => {
      const ret = Number(inv.retention_amount || 0);
      const out = Number(inv.net_payable_amount || 0) - Number(inv.paid_amount || 0);
      const pph = out > 0 ? out : 0;
      
      piutangRetensiAkhir += ret;
      piutangPphAkhir += pph;
      
      if (inv.invoice_date < startDate) {
        piutangRetensiAwal += ret;
        piutangPphAwal += pph;
      }
    });
  } else if (termins && termins.length > 0) {
    // Fallback menggunakan project_termins
    const totalRetensiTermin = termins.reduce((sum, t) => sum + Number(t.retention_amount || 0), 0);
    const totalDeductions = Math.max(0, totalInvoiced - cfOperationalIn);
    piutangPphAkhir = Math.max(0, totalDeductions - totalRetensiTermin);
    piutangRetensiAkhir = totalRetensiTermin;
    
    const terminsAwal = termins.filter((t:any) => t.created_at < startDate);
    const totalRetensiAwal = terminsAwal.reduce((sum, t) => sum + Number(t.retention_amount || 0), 0);
    piutangRetensiAwal = totalRetensiAwal;
    piutangPphAwal = 0; // Simplified
  }

  const { data: releases } = await supabase.from('retention_releases').select('amount, release_date').eq('project_id', safeProjectId).eq('status', 'Paid').lte('release_date', endDate);
  let totalRetensiRilisAkhir = 0, totalRetensiRilisAwal = 0;
  (releases || []).forEach((r: any) => {
    totalRetensiRilisAkhir += Number(r.amount || 0);
    if (r.release_date < startDate) totalRetensiRilisAwal += Number(r.amount || 0);
  });
  
  const piutangRetensi = Math.max(0, piutangRetensiAkhir - totalRetensiRilisAkhir);
  const piutangRetensiAwalVal = Math.max(0, piutangRetensiAwal - totalRetensiRilisAwal);

  // FIX BUG 1: contractAssetLiability harus dipisah antara awal dan akhir
  const contractAssetLiability = revenueRecognized - totalInvoiced;
  const contractAssetLiabilityAwal = 0 - totalInvoicedAwal; // Asumsi Pendapatan Awal = 0

  const { data: poData } = await supabase.from('purchase_orders').select('paid_amount, created_at').eq('project_id', safeProjectId).neq('status', 'Void').lte('created_at', `${endDate}T23:59:59Z`);
  let totalPoPaidAkhir = 0, totalPoPaidAwal = 0;
  (poData || []).forEach((po: any) => {
    const paid = Number(po.paid_amount || 0);
    totalPoPaidAkhir += paid;
    if (po.created_at < startDate) totalPoPaidAwal += paid;
  });
  
  const utangUsaha = Math.max(0, totalGrnValue - totalPoPaidAkhir);
  const utangUsahaAwal = Math.max(0, 0 - totalPoPaidAwal); // Simplifikasi GRN Awal = 0

  let totalSubconPaidOpname = 0, utangRetensiSubkon = 0;
  let totalSubconPaidOpnameAwal = 0, utangRetensiSubkonAwal = 0;
  (subconData || []).forEach((p: any) => {
    if (p.payment_type === 'Opname') {
      totalSubconPaidOpname += Number(p.amount);
      if (p.payment_date < startDate) totalSubconPaidOpnameAwal += Number(p.amount);
    }
    utangRetensiSubkon += Number(p.retention_amount || 0);
    if (p.payment_date < startDate) utangRetensiSubkonAwal += Number(p.retention_amount || 0);
  });
  const utangSubkon = Math.max(0, totalSubconOpname - totalSubconPaidOpname);
  const utangSubkonAwal = Math.max(0, totalSubconOpname - totalSubconPaidOpnameAwal);

  const biayaAkrual = accrualUpah + accrualAlat + accrualOperasional;
  const rkPusat = cfDropingIn - cfDropingOut;
  const rkPusatAwal = cfDropingInAwal - cfDropingOutAwal;
  const labaBerjalan = netProfit;
  
  const createItem = (akhir: number, awal: number): BalanceItem => ({ awal, mutasi: akhir - awal, akhir });

  const kasItem = createItem(cfKasAkhir, cfKasAwal);
  const pphItem = createItem(piutangPphAkhir, piutangPphAwal);
  const retensiItem = createItem(piutangRetensi, piutangRetensiAwalVal);
  const kontrakAsetLiabItem = createItem(contractAssetLiability, contractAssetLiabilityAwal); 
  const persediaanItem = createItem(recognizedStock, 0);
  const kasbonItem = createItem(unearnedKasbon, 0);
  const utangUsahaItem = createItem(utangUsaha, utangUsahaAwal);
  const utangSubkonItem = createItem(utangSubkon, utangSubkonAwal);
  const biayaAkrualItem = createItem(biayaAkrual, 0);
  const utangRetensiSubkonItem = createItem(utangRetensiSubkon, utangRetensiSubkonAwal);
  const rkPusatItem = createItem(rkPusat, rkPusatAwal);
  const labaItem = createItem(labaBerjalan, 0);

  const totalAsetItem = createItem(
    kasItem.akhir + retensiItem.akhir + pphItem.akhir + Math.max(0, kontrakAsetLiabItem.akhir) + persediaanItem.akhir + kasbonItem.akhir,
    kasItem.awal + retensiItem.awal + pphItem.awal + Math.max(0, kontrakAsetLiabItem.awal) + persediaanItem.awal + kasbonItem.awal
  );

  const totalLiabEqItem = createItem(
    utangUsahaItem.akhir + utangSubkonItem.akhir + biayaAkrualItem.akhir + Math.max(0, -kontrakAsetLiabItem.akhir) + utangRetensiSubkonItem.akhir + rkPusatItem.akhir + labaItem.akhir,
    utangUsahaItem.awal + utangSubkonItem.awal + biayaAkrualItem.awal + Math.max(0, -kontrakAsetLiabItem.awal) + utangRetensiSubkonItem.awal + rkPusatItem.awal + labaItem.awal
  );

  const variance = totalAsetItem.akhir - totalLiabEqItem.akhir;
  const isBalanced = Math.abs(variance) < 1;

  return {
    asOfDate: endDate,
    periodStart: startDate,
    project,
    summary: {
      contractValue: contractVal,
      totalRAP,
      pocPercent,
      totalInvoiced,
      remainingContract: Math.max(0, contractVal - totalInvoiced)
    },
    assets: {
      kasBank: kasItem,
      piutangUsaha: createItem(0,0),
      piutangRetensi: retensiItem,
      pphDibayarDimuka: pphItem,
      asetKontrak: createItem(Math.max(0, kontrakAsetLiabItem.akhir), Math.max(0, kontrakAsetLiabItem.awal)),
      persediaan: persediaanItem,
      uangMuka: kasbonItem,
      total: totalAsetItem
    },
    liabilitiesEquity: {
      utangUsaha: utangUsahaItem,
      utangSubkon: utangSubkonItem,
      biayaAkrual: biayaAkrualItem,
      liabilitasKontrak: createItem(Math.max(0, -kontrakAsetLiabItem.akhir), Math.max(0, -kontrakAsetLiabItem.awal)),
      utangRetensiSubkon: utangRetensiSubkonItem,
      rkPusat: rkPusatItem,
      labaBerjalan: labaItem,
      total: totalLiabEqItem
    },
    isBalanced,
    variance
  };
}

// ==========================================
// D. FUNGSI HISTORY (SNAPSHOT)
// ==========================================
export async function saveBalanceSheetSnapshot(
  projectId: string, 
  periodStart: string, 
  periodEnd: string, 
  data: BalanceSheetResult, 
  createdBy: string
) {
  const { data: snapshot, error } = await supabase
    .from('balance_sheet_snapshots')
    .insert({
      project_id: projectId,
      period_start: periodStart,
      period_end: periodEnd,
      data_json: data,
      created_by: createdBy
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return snapshot;
}

export async function getBalanceSheetHistory(projectId: string) {
  const { data, error } = await supabase
    .from('balance_sheet_snapshots')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_deleted', false) // Hanya ambil yang tidak dihapus
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteBalanceSheetSnapshot(snapshotId: string) {
  // ABSOLUTE RULE #2: Dilarang Hard Delete, gunakan Soft Delete
  const { error } = await supabase
    .from('balance_sheet_snapshots')
    .update({ is_deleted: true })
    .eq('id', snapshotId);

  if (error) throw new Error(error.message);
  return true;
}