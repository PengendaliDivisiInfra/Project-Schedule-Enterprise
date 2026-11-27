// lib/utils/vendor-equipment-controls.ts

export interface VendorComplianceInput {
  name: string;
  isBlacklisted?: boolean | null;
  blacklistReason?: string | null;
  npwpNumber?: string | null;
  pkpStatus?: string | null;
  pkpExpiryDate?: string | null;
  legalExpiryDate?: string | null;
}

export interface VendorComplianceResult {
  allowed: boolean;
  status: 'COMPLIANT' | 'BLACKLISTED' | 'TAX_EXPIRED' | 'LEGAL_EXPIRED';
  reasons: string[];
  daysUntilEarliestExpiry: number | null;
}

export interface VendorScorecardInput {
  deliveryScore: number; // 1..5 (bobot 35%)
  qualityScore: number;  // 1..5 (bobot 35%)
  safetyScore: number;   // 1..5 (bobot 30%)
}

export interface VendorScorecardResult {
  deliveryScore: number;
  qualityScore: number;
  safetyScore: number;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  recommendation: 'PREFERRED' | 'APPROVED' | 'PROBATION' | 'BLACKLIST_RECOMMENDED';
}

export interface RentalAccrualInput {
  rentalBasis: 'Hourly' | 'Daily' | 'Monthly' | string;
  baseRate: number;
  dailyNormalHoursLimit?: number;
  startDate: string;
  endDate: string;
  referenceDate?: Date;
}

export interface RentalAccrualResult {
  dailyRate: number;
  elapsedActiveDays: number;
  accumulatedAccrual: number;
  daysToExpiry: number;
  expirySeverity: 'EXPIRED' | 'CRITICAL_3D' | 'WARNING_7D' | 'UPCOMING_14D' | 'SAFE';
  alertMessage: string;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function diffCalendarDays(targetDateStr: string, refDate: Date): number | null {
  if (!targetDateStr) return null;
  const t = new Date(targetDateStr);
  if (Number.isNaN(t.getTime())) return null;
  const startRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const startTgt = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((startTgt.getTime() - startRef.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Validasi Kepatuhan Vendor / Subkontraktor Terpusat:
 * Memblokir PO/SPK jika vendor di-Blacklist atau dokumen PKP/NPWP/Legalitas kedaluwarsa.
 */
export function evaluateVendorCompliance(
  vendor: VendorComplianceInput,
  referenceDate: Date = new Date()
): VendorComplianceResult {
  const reasons: string[] = [];
  let status: VendorComplianceResult['status'] = 'COMPLIANT';

  if (vendor.isBlacklisted) {
    status = 'BLACKLISTED';
    reasons.push(
      `Vendor "${vendor.name}" berstatus BLACKLIST (${vendor.blacklistReason || 'Pelanggaran kepatuhan'}). Seluruh pembuatan PO/SPK diblokir.`
    );
  }

  const pkpDays =
    String(vendor.pkpStatus || '').toUpperCase() === 'PKP' && vendor.pkpExpiryDate
      ? diffCalendarDays(vendor.pkpExpiryDate, referenceDate)
      : null;

  if (pkpDays !== null && pkpDays < 0) {
    if (status === 'COMPLIANT') status = 'TAX_EXPIRED';
    reasons.push(
      `Dokumen PKP / NPWP vendor "${vendor.name}" kedaluwarsa ${Math.abs(pkpDays)} hari lalu (${vendor.pkpExpiryDate}).`
    );
  }

  const legalDays = vendor.legalExpiryDate
    ? diffCalendarDays(vendor.legalExpiryDate, referenceDate)
    : null;

  if (legalDays !== null && legalDays < 0) {
    if (status === 'COMPLIANT') status = 'LEGAL_EXPIRED';
    reasons.push(
      `Dokumen legalitas (NIB/SBU/SIUJK) vendor "${vendor.name}" kedaluwarsa ${Math.abs(legalDays)} hari lalu (${vendor.legalExpiryDate}).`
    );
  }

  const expiryCandidates = [pkpDays, legalDays].filter((d): d is number => d !== null);
  const daysUntilEarliestExpiry =
    expiryCandidates.length > 0 ? Math.min(...expiryCandidates) : null;

  return {
    allowed: status === 'COMPLIANT',
    status,
    reasons,
    daysUntilEarliestExpiry,
  };
}

/**
 * Menghitung Vendor Performance Scorecard tertimbang:
 * - Ketepatan Waktu Pengiriman (Delivery): 35%
 * - Kualitas Barang / Jasa (Quality): 35%
 * - Kepatuhan K3 (Safety): 30%
 */
export function calculateVendorScorecard(
  input: VendorScorecardInput
): VendorScorecardResult {
  const clamp = (v: number) => Math.min(5, Math.max(1, toNum(v)));
  const deliveryScore = clamp(input.deliveryScore);
  const qualityScore = clamp(input.qualityScore);
  const safetyScore = clamp(input.safetyScore);

  const overallScore =
    Math.round((deliveryScore * 0.35 + qualityScore * 0.35 + safetyScore * 0.3) * 100) / 100;

  let grade: VendorScorecardResult['grade'] = 'D';
  let recommendation: VendorScorecardResult['recommendation'] = 'BLACKLIST_RECOMMENDED';

  if (overallScore >= 4.25) {
    grade = 'A';
    recommendation = 'PREFERRED';
  } else if (overallScore >= 3.5) {
    grade = 'B';
    recommendation = 'APPROVED';
  } else if (overallScore >= 2.5) {
    grade = 'C';
    recommendation = 'PROBATION';
  }

  return {
    deliveryScore,
    qualityScore,
    safetyScore,
    overallScore,
    grade,
    recommendation,
  };
}

/**
 * Menghitung estimasi beban sewa harian (Daily Rental Cost Accrual)
 * dan tingkat peringatan masa berakhir sewa alat (mencegah denda perpanjangan).
 */
export function calculateDailyRentalAccrual(
  input: RentalAccrualInput
): RentalAccrualResult {
  const ref = input.referenceDate || new Date();
  const basis = String(input.rentalBasis || 'Hourly').toLowerCase();
  const rate = Math.max(0, toNum(input.baseRate));
  const dailyHours = Math.max(1, toNum(input.dailyNormalHoursLimit ?? 8));

  let dailyRate = rate * dailyHours;
  if (basis === 'daily') dailyRate = rate;
  else if (basis === 'monthly') dailyRate = Math.round((rate / 30) * 100) / 100;
  else dailyRate = Math.round(rate * dailyHours * 100) / 100;

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const daysToExpiry = diffCalendarDays(input.endDate, ref) ?? 0;

  let elapsedActiveDays = 0;
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const startFloor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endFloor = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const refFloor = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const effectiveEnd = refFloor < endFloor ? refFloor : endFloor;
    if (effectiveEnd >= startFloor) {
      elapsedActiveDays =
        Math.round((effectiveEnd.getTime() - startFloor.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  const accumulatedAccrual = Math.round(elapsedActiveDays * dailyRate * 100) / 100;

  let expirySeverity: RentalAccrualResult['expirySeverity'] = 'SAFE';
  let alertMessage = `Masa sewa aman (${daysToExpiry} hari tersisa).`;

  if (daysToExpiry < 0) {
    expirySeverity = 'EXPIRED';
    alertMessage = `Masa sewa berakhir ${Math.abs(daysToExpiry)} hari lalu — risiko denda perpanjangan otomatis!`;
  } else if (daysToExpiry <= 3) {
    expirySeverity = 'CRITICAL_3D';
    alertMessage = `KRITIS: Masa sewa berakhir dalam H-${daysToExpiry} hari. Segera demobilisasi atau buat addendum sewa.`;
  } else if (daysToExpiry <= 7) {
    expirySeverity = 'WARNING_7D';
    alertMessage = `Perhatian: Masa sewa berakhir dalam H-${daysToExpiry} hari.`;
  } else if (daysToExpiry <= 14) {
    expirySeverity = 'UPCOMING_14D';
    alertMessage = `Masa sewa mendekati akhir (H-${daysToExpiry} hari).`;
  }

  return {
    dailyRate,
    elapsedActiveDays,
    accumulatedAccrual,
    daysToExpiry,
    expirySeverity,
    alertMessage,
  };
}

/**
 * Membangun payload QR Code standar untuk stiker Asset Tag (maks <= 78 byte untuk QR v4-L).
 */
export function buildAssetQrPayload(params: {
  assetTag: string;
  unitId: string;
  projectId?: string | null;
}): string {
  const cleanTag = String(params.assetTag || 'AST').replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 20);
  const shortUnit = String(params.unitId || '').slice(0, 18);
  const shortProj = String(params.projectId || 'HQ').slice(0, 12);
  return `PRO-ASSET|${cleanTag}|${shortUnit}|${shortProj}`;
}
