// lib/utils/sak-calculator.ts

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
  taxMode: 'EXCLUDE' | 'INCLUDE';
}

export function hitungSAK(params: {
  bruttoSd: number;       // Total Opname s/d saat ini
  nilaiKontrak: number;
  nilaiDP: number;        // Uang Muka
  pphRate: number;        // cth: 2.65
  ppnRate: number;        // cth: 11
  retensiRate: number;    // cth: 5
  kasbonDeduct: number;   // Total kasbon yang dipotong
  taxMode?: 'EXCLUDE' | 'INCLUDE';
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
    E_invoice = nilaiSetelahDP;
    C_dpp = E_invoice / (1 + (params.ppnRate / 100));
    D_ppn = E_invoice - C_dpp;
  } else {
    C_dpp = nilaiSetelahDP;
    D_ppn = C_dpp * (params.ppnRate / 100);
    E_invoice = C_dpp + D_ppn;
  }

  // F = PPh Pasal 4(2)
  const F_pph42 = C_dpp * (params.pphRate / 100);
  
  // G = Invoice Bersih
  const G_invoiceBersih = E_invoice - F_pph42;
  
  // R = Retensi Proyek
  const R_retensi = C_dpp * (params.retensiRate / 100);
  
  // K = Potongan Kasbon
  const K_kasbon = params.kasbonDeduct;
  
  // Net = Total Dibayarkan
  const Net_transfer = G_invoiceBersih - R_retensi - K_kasbon;

  return {
    A_bruto, B_potonganDP, C_dpp, D_ppn, E_invoice,
    F_pph42, G_invoiceBersih, R_retensi, K_kasbon, Net_transfer,
    persenProgres, taxMode
  };
}