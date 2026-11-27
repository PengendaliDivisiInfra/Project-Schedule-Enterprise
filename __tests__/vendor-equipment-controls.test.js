import {
  evaluateVendorCompliance,
  calculateVendorScorecard,
  calculateDailyRentalAccrual,
  buildAssetQrPayload,
} from '@/lib/utils/vendor-equipment-controls';
import { generateQrMatrix, generateQrSvg } from '@/lib/utils/qr-svg';

describe('Wave E: Vendor Compliance/Scorecard, Rental Accrual & Asset Custody QR', () => {
  test('evaluateVendorCompliance memblokir vendor BLACKLIST atau PKP/Legal kedaluwarsa', () => {
    const ref = new Date('2026-11-27T00:00:00Z');

    const blacklisted = evaluateVendorCompliance(
      { name: 'PT Bermasalah', isBlacklisted: true, blacklistReason: 'Faktur fiktif' },
      ref
    );
    expect(blacklisted.allowed).toBe(false);
    expect(blacklisted.status).toBe('BLACKLISTED');

    const taxExpired = evaluateVendorCompliance(
      { name: 'CV Pajak Mati', pkpStatus: 'PKP', pkpExpiryDate: '2026-10-01' },
      ref
    );
    expect(taxExpired.allowed).toBe(false);
    expect(taxExpired.status).toBe('TAX_EXPIRED');

    const legalExpired = evaluateVendorCompliance(
      { name: 'CV SBU Habis', legalExpiryDate: '2026-11-01' },
      ref
    );
    expect(legalExpired.allowed).toBe(false);
    expect(legalExpired.status).toBe('LEGAL_EXPIRED');

    const ok = evaluateVendorCompliance(
      { name: 'PT Baja Prima', pkpStatus: 'PKP', pkpExpiryDate: '2027-12-31', legalExpiryDate: '2027-06-30' },
      ref
    );
    expect(ok.allowed).toBe(true);
    expect(ok.status).toBe('COMPLIANT');
  });

  test('calculateVendorScorecard menghitung skor tertimbang Waktu 35% + Mutu 35% + K3 30% dan Grade', () => {
    const gradeA = calculateVendorScorecard({ deliveryScore: 5, qualityScore: 4.5, safetyScore: 4.5 });
    expect(gradeA.overallScore).toBe(4.68);
    expect(gradeA.grade).toBe('A');
    expect(gradeA.recommendation).toBe('PREFERRED');

    const gradeD = calculateVendorScorecard({ deliveryScore: 2, qualityScore: 2, safetyScore: 2 });
    expect(gradeD.overallScore).toBe(2);
    expect(gradeD.grade).toBe('D');
    expect(gradeD.recommendation).toBe('BLACKLIST_RECOMMENDED');
  });

  test('calculateDailyRentalAccrual menghitung burn rate harian, akumulasi accrual, dan peringatan H-3/Expired', () => {
    const ref = new Date('2026-11-27T00:00:00Z');

    const hourlyCritical = calculateDailyRentalAccrual({
      rentalBasis: 'Hourly',
      baseRate: 450_000,
      dailyNormalHoursLimit: 8,
      startDate: '2026-11-18',
      endDate: '2026-11-29',
      referenceDate: ref,
    });
    expect(hourlyCritical.dailyRate).toBe(3_600_000);
    expect(hourlyCritical.elapsedActiveDays).toBe(10);
    expect(hourlyCritical.accumulatedAccrual).toBe(36_000_000);
    expect(hourlyCritical.expirySeverity).toBe('CRITICAL_3D');

    const monthlyExpired = calculateDailyRentalAccrual({
      rentalBasis: 'Monthly',
      baseRate: 30_000_000,
      startDate: '2026-10-01',
      endDate: '2026-11-20',
      referenceDate: ref,
    });
    expect(monthlyExpired.dailyRate).toBe(1_000_000);
    expect(monthlyExpired.expirySeverity).toBe('EXPIRED');
  });

  test('buildAssetQrPayload & generateQrSvg menghasilkan matriks QR Version 4-L (33x33) valid offline', () => {
    const payload = buildAssetQrPayload({
      assetTag: 'AST-EX01',
      unitId: 'unit-123456',
      projectId: 'proj-saddang',
    });
    expect(payload).toBe('PRO-ASSET|AST-EX01|unit-123456|proj-saddang');

    const matrix = generateQrMatrix(payload);
    expect(matrix).toHaveLength(33);
    expect(matrix[0]).toHaveLength(33);
    // Cek finder pattern top-left (0,0) = dark
    expect(matrix[0][0]).toBe(true);

    const svg = generateQrSvg(payload, 180);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 41 41"');
  });
});
