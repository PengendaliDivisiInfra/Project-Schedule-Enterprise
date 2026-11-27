// lib/utils/hse-workforce-controls.ts

export interface HsePermitRecord {
  id?: string;
  wbs_code?: string | null;
  permit_type: 'JSA' | 'WORK_PERMIT' | 'ZERO_ACCIDENT' | string;
  permit_number: string;
  valid_from: string;
  valid_until: string;
  status: 'Draft' | 'Active' | 'Expired' | 'Revoked' | string;
}

export interface HseGateEvaluation {
  allowed: boolean;
  requiresHseGate: boolean;
  hasActiveJsa: boolean;
  hasActiveWorkPermit: boolean;
  hasSafetyClearance: boolean;
  matchedPermitId: string | null;
  missingRequirements: string[];
  message: string;
}

export interface AttendanceRecordForGhostCheck {
  employeeId: string;
  employeeName: string;
  nik: string | null | undefined;
  projectId: string;
  projectName?: string;
  attendanceDate: string;
  status: string;
}

export interface GhostWorkerCheckResult {
  hasConflict: boolean;
  normalizedNik: string;
  conflictingProjectId: string | null;
  conflictingProjectName: string | null;
  message: string;
}

export interface CompressionStats {
  originalBytes: number;
  compressedBytes: number;
  savedBytes: number;
  savedPercent: number;
  originalLabel: string;
  compressedLabel: string;
}

const PRESENT_STATUSES = new Set(['present', 'hadir', 'overtime', 'half day', 'half_day']);

function formatBytes(bytes: number): string {
  const b = Math.max(0, Number(bytes) || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function normalizeNik(nik: string | null | undefined): string {
  return String(nik || '').replace(/[^0-9]/g, '');
}

/**
 * Evaluasi HSE / K3 Compliance Gate sebelum validasi progres harian:
 * - Pekerjaan risiko normal (`isHighRisk = false`) selalu diizinkan.
 * - Pekerjaan risiko tinggi (`isHighRisk = true`) wajib memiliki JSA aktif atau Work Permit aktif
 *   pada tanggal progres (spesifik WBS atau cakupan umum proyek).
 */
export function evaluateHseComplianceGate(params: {
  isHighRisk: boolean;
  wbsCode?: string | null;
  recordDate: string;
  permits: HsePermitRecord[];
  requireBothJsaAndPermit?: boolean;
}): HseGateEvaluation {
  if (!params.isHighRisk) {
    return {
      allowed: true,
      requiresHseGate: false,
      hasActiveJsa: true,
      hasActiveWorkPermit: true,
      hasSafetyClearance: true,
      matchedPermitId: null,
      missingRequirements: [],
      message: 'Pekerjaan standar (tidak memerlukan HSE High-Risk Gate).',
    };
  }

  const targetDate = params.recordDate || new Date().toISOString().split('T')[0];
  const wbs = (params.wbsCode || '').trim();

  const matchingActive = (params.permits || []).filter((p) => {
    if (!p || String(p.status || '').toLowerCase() !== 'active') return false;
    const pWbs = (p.wbs_code || '').trim();
    const wbsOk = !pWbs || !wbs || pWbs === wbs;
    if (!wbsOk) return false;
    return targetDate >= p.valid_from && targetDate <= p.valid_until;
  });

  const activeJsa = matchingActive.find((p) => String(p.permit_type).toUpperCase() === 'JSA');
  const activeWorkPermit = matchingActive.find(
    (p) => String(p.permit_type).toUpperCase() === 'WORK_PERMIT'
  );
  const activeZeroAcc = matchingActive.find(
    (p) => String(p.permit_type).toUpperCase() === 'ZERO_ACCIDENT'
  );

  const hasActiveJsa = Boolean(activeJsa);
  const hasActiveWorkPermit = Boolean(activeWorkPermit);
  const hasSafetyClearance = Boolean(activeZeroAcc || activeJsa || activeWorkPermit);

  const missingRequirements: string[] = [];
  if (params.requireBothJsaAndPermit) {
    if (!hasActiveJsa) missingRequirements.push('Dokumen JSA (Job Safety Analysis) aktif');
    if (!hasActiveWorkPermit) missingRequirements.push('Dokumen Work Permit (Izin Kerja) aktif');
  } else if (!hasActiveJsa && !hasActiveWorkPermit) {
    missingRequirements.push('Dokumen JSA atau Work Permit (Izin Kerja) aktif');
  }

  const allowed = missingRequirements.length === 0;
  const matchedPermitId = activeWorkPermit?.id || activeJsa?.id || null;

  return {
    allowed,
    requiresHseGate: true,
    hasActiveJsa,
    hasActiveWorkPermit,
    hasSafetyClearance,
    matchedPermitId,
    missingRequirements,
    message: allowed
      ? 'HSE Compliance Gate Lulus: JSA / Work Permit aktif terverifikasi.'
      : `HSE Gate Diblokir: Pekerjaan risiko tinggi wajib melengkapi ${missingRequirements.join(' & ')}.`,
  };
}

/**
 * Deteksi Anti-Ghost Workers lintas proyek:
 * Memblokir absensi hadir jika NIK identik sudah tercatat hadir di proyek berbeda pada tanggal sama.
 */
export function detectGhostWorkerConflict(params: {
  candidate: AttendanceRecordForGhostCheck;
  existingAttendances: AttendanceRecordForGhostCheck[];
}): GhostWorkerCheckResult {
  const normNik = normalizeNik(params.candidate.nik);
  const candStatus = String(params.candidate.status || '').toLowerCase().trim();

  if (!PRESENT_STATUSES.has(candStatus) || normNik.length < 6) {
    return {
      hasConflict: false,
      normalizedNik: normNik,
      conflictingProjectId: null,
      conflictingProjectName: null,
      message: 'Tidak ada konflik absensi lintas proyek.',
    };
  }

  const conflict = (params.existingAttendances || []).find((rec) => {
    if (!rec) return false;
    const recStatus = String(rec.status || '').toLowerCase().trim();
    if (!PRESENT_STATUSES.has(recStatus)) return false;
    if (rec.attendanceDate !== params.candidate.attendanceDate) return false;
    if (rec.projectId === params.candidate.projectId) return false;
    return normalizeNik(rec.nik) === normNik;
  });

  if (conflict) {
    const projLabel = conflict.projectName || conflict.projectId;
    return {
      hasConflict: true,
      normalizedNik: normNik,
      conflictingProjectId: conflict.projectId,
      conflictingProjectName: projLabel,
      message: `Anti-Ghost Worker: "${params.candidate.employeeName}" (NIK ${normNik}) sudah tercatat HADIR pada ${params.candidate.attendanceDate} di proyek "${projLabel}".`,
    };
  }

  return {
    hasConflict: false,
    normalizedNik: normNik,
    conflictingProjectId: null,
    conflictingProjectName: null,
    message: 'Absensi valid (tidak ada klaim upah ganda lintas proyek).',
  };
}

/**
 * Menghitung rasio penghematan ukuran foto lapangan setelah kompresi otomatis.
 */
export function calculateCompressionStats(
  originalBytes: number,
  compressedBytes: number
): CompressionStats {
  const orig = Math.max(0, Number(originalBytes) || 0);
  const comp = Math.max(0, Number(compressedBytes) || 0);
  const savedBytes = Math.max(0, orig - comp);
  const savedPercent = orig > 0 ? Math.round((savedBytes / orig) * 1000) / 10 : 0;

  return {
    originalBytes: orig,
    compressedBytes: comp,
    savedBytes,
    savedPercent,
    originalLabel: formatBytes(orig),
    compressedLabel: formatBytes(comp),
  };
}
