// lib/utils/sak-calculator.ts

export type TaxMode = 'EXCLUDE' | 'INCLUDE' | 'NON_PAJAK';

export interface SAKResult {
  A_bruto: number;
  B_potonganDP: number;
  C_dpp: number;
  D_ppn: number;
  E_invoice: number;
  F_pph42: number;
  G_invoiceBersih: number;
  R_retensi: number;
  K_kasbon: number;
  Net_transfer: number;
  persenProgres: number;
  taxMode: TaxMode;
  // Tambahan untuk mempermudah UI
  ppnPct: number;
  pphPct: number;
  retPct: number;
}

export function hitungSAK(params: {
  bruttoSd: number;       
  nilaiKontrak: number;
  nilaiDP: number;        
  pphRate: number;        
  ppnRate: number;        
  retensiRate: number;    
  kasbonDeduct: number;   
  taxMode?: TaxMode;
}): SAKResult {
  const taxMode = params.taxMode || 'EXCLUDE';
  
  // A = Nilai Progres Bruto
  const A_bruto = params.bruttoSd;
  
  // B = Potongan Pengembalian DP (Proporsional)
  const persenProgres = params.nilaiKontrak > 0 ? (A_bruto / params.nilaiKontrak) : 0;
  const B_potonganDP = persenProgres * params.nilaiDP;
  
  // C = DPP (Dasar Pengenaan Pajak)
  const nilaiSetelahDP = A_bruto - B_potonganDP;
  let C_dpp = 0;
  let D_ppn = 0;
  let E_invoice = 0;

  if (taxMode === 'INCLUDE') {
    // PPN sudah termasuk dalam nilai kontrak. Ekstrak DPP.
    E_invoice = nilaiSetelahDP; 
    C_dpp = E_invoice / (1 + (params.ppnRate / 100));
    D_ppn = E_invoice - C_dpp;
  } else if (taxMode === 'NON_PAJAK') {
    // Tidak ada PPN
    C_dpp = nilaiSetelahDP;
    D_ppn = 0;
    E_invoice = C_dpp;
  } else {
    // EXCLUDE (Default) - PPN ditambahkan di luar
    C_dpp = nilaiSetelahDP;
    D_ppn = C_dpp * (params.ppnRate / 100);
    E_invoice = C_dpp + D_ppn;
  }

  // F = PPh Pasal 4(2) -> Selalu dihitung dari DPP
  const F_pph42 = C_dpp * (params.pphRate / 100);
  
  // G = Invoice Bersih (Dikurangi PPh)
  const G_invoiceBersih = E_invoice - F_pph42;
  
  // R = Retensi Proyek -> Selalu dihitung dari DPP
  const R_retensi = C_dpp * (params.retensiRate / 100);
  
  // K = Potongan Kasbon
  const K_kasbon = params.kasbonDeduct;
  
  // Net = Total Dibayarkan
  const Net_transfer = G_invoiceBersih - R_retensi - K_kasbon;

  return {
    A_bruto, 
    B_potonganDP, 
    C_dpp, 
    D_ppn, 
    E_invoice,
    F_pph42, 
    G_invoiceBersih, 
    R_retensi, 
    K_kasbon, 
    Net_transfer,
    persenProgres, 
    taxMode,
    ppnPct: params.ppnRate,
    pphPct: params.pphRate,
    retPct: params.retensiRate
  };
}