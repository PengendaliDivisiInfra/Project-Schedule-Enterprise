import { hitungSAK } from '@/lib/utils/sak-calculator';

describe('SAK Calculator (hitungSAK)', () => {
  test('mode EXCLUDE menghitung DP proporsional, DPP, PPN 11%, PPh 4(2), Retensi, dan Net Transfer dengan tepat', () => {
    const res = hitungSAK({
      bruttoSd: 500_000_000,
      nilaiKontrak: 1_000_000_000,
      nilaiDP: 100_000_000,
      pphRate: 2,
      ppnRate: 11,
      retensiRate: 5,
      kasbonDeduct: 10_000_000,
      taxMode: 'EXCLUDE',
    });

    expect(res.persenProgres).toBeCloseTo(0.5, 6);
    expect(res.A_bruto).toBe(500_000_000);
    expect(res.B_potonganDP).toBeCloseTo(50_000_000, 2);
    expect(res.C_dpp).toBeCloseTo(450_000_000, 2);
    expect(res.D_ppn).toBeCloseTo(49_500_000, 2);
    expect(res.E_invoice).toBeCloseTo(499_500_000, 2);
    expect(res.F_pph42).toBeCloseTo(9_000_000, 2);
    expect(res.G_invoiceBersih).toBeCloseTo(490_500_000, 2);
    expect(res.R_retensi).toBeCloseTo(22_500_000, 2);
    expect(res.K_kasbon).toBe(10_000_000);
    expect(res.Net_transfer).toBeCloseTo(458_000_000, 2);
  });

  test('mode INCLUDE mengekstrak DPP dan PPN dari nilai setelah DP dengan benar', () => {
    const res = hitungSAK({
      bruttoSd: 111_000_000,
      nilaiKontrak: 1_110_000_000,
      nilaiDP: 0,
      pphRate: 2,
      ppnRate: 11,
      retensiRate: 5,
      kasbonDeduct: 0,
      taxMode: 'INCLUDE',
    });

    expect(res.E_invoice).toBeCloseTo(111_000_000, 2);
    expect(res.C_dpp).toBeCloseTo(100_000_000, 2);
    expect(res.D_ppn).toBeCloseTo(11_000_000, 2);
    expect(res.F_pph42).toBeCloseTo(2_000_000, 2);
    expect(res.R_retensi).toBeCloseTo(5_000_000, 2);
    expect(res.Net_transfer).toBeCloseTo(104_000_000, 2);
  });

  test('mode NON_PAJAK menghasilkan PPN 0 tetapi tetap menghitung PPh 4(2) & Retensi dari DPP', () => {
    const res = hitungSAK({
      bruttoSd: 200_000_000,
      nilaiKontrak: 1_000_000_000,
      nilaiDP: 50_000_000,
      pphRate: 1.75,
      ppnRate: 11,
      retensiRate: 5,
      kasbonDeduct: 0,
      taxMode: 'NON_PAJAK',
    });

    expect(res.B_potonganDP).toBeCloseTo(10_000_000, 2);
    expect(res.C_dpp).toBeCloseTo(190_000_000, 2);
    expect(res.D_ppn).toBe(0);
    expect(res.E_invoice).toBeCloseTo(190_000_000, 2);
    expect(res.F_pph42).toBeCloseTo(3_325_000, 2);
    expect(res.R_retensi).toBeCloseTo(9_500_000, 2);
    expect(res.Net_transfer).toBeCloseTo(177_175_000, 2);
  });

  test('membatasi potongan DP maksimum 100% saat over-volume atau addendum (brutto > kontrak)', () => {
    const res = hitungSAK({
      bruttoSd: 1_200_000_000,
      nilaiKontrak: 1_000_000_000,
      nilaiDP: 100_000_000,
      pphRate: 2,
      ppnRate: 11,
      retensiRate: 5,
      kasbonDeduct: 0,
      taxMode: 'EXCLUDE',
    });

    expect(res.persenProgres).toBe(1);
    expect(res.B_potonganDP).toBeCloseTo(100_000_000, 2);
    expect(res.C_dpp).toBeCloseTo(1_100_000_000, 2);
  });

  test('aman terhadap nilaiKontrak = 0 tanpa menghasilkan NaN atau Infinity', () => {
    const res = hitungSAK({
      bruttoSd: 50_000_000,
      nilaiKontrak: 0,
      nilaiDP: 10_000_000,
      pphRate: 2,
      ppnRate: 11,
      retensiRate: 5,
      kasbonDeduct: 0,
    });

    expect(res.persenProgres).toBe(0);
    expect(res.B_potonganDP).toBe(0);
    expect(Number.isFinite(res.Net_transfer)).toBe(true);
  });
});
