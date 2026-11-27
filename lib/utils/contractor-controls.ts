// lib/utils/contractor-controls.ts

export interface RingFencedCashflowInput {
  clientInflow: number;
  hqDropping?: number;
  actualOutflow: number;
  pendingOutflow?: number;
  requestedOutflow?: number;
  ringFencedEnabled?: boolean;
  hqDroppingLimit?: number;
}

export interface RingFencedCashflowResult {
  totalInflow: number;
  totalCommittedOutflow: number;
  currentBalance: number;
  projectedBalance: number;
  deficitAmount: number;
  allowed: boolean;
  requiresHqDropping: boolean;
  status: 'SURPLUS' | 'TIGHT' | 'DEFICIT_WITH_DROPPING' | 'DEFICIT_BLOCKED';
  message: string;
}

export type ExpiryAlertSeverity = 'EXPIRED' | 'CRITICAL_7D' | 'WARNING_14D' | 'UPCOMING_30D' | 'SAFE';

export interface ExpiryAlertResult {
  daysRemaining: number;
  severity: ExpiryAlertSeverity;
  label: string;
  requiresAction: boolean;
}

export interface WbsProgressItem {
  cost: number;
  progressPercent: number;
  summary?: string | null;
}

export interface BakpBillingResult {
  weightedActualProgressPct: number;
  previousProgressPct: number;
  deltaProgressPct: number;
  grossAmount: number;
  retentionAmount: number;
  ppnAmount: number;
  netBillableAmount: number;
}

export interface VariationCostEntry {
  recordId: string;
  sourceType: 'CASH_FLOW' | 'PURCHASE_ORDER';
  wbsCode?: string | null;
  workLabel: string;
  incurredCost: number;
  isVariationWork: boolean;
  ccoStatus?: string | null;
}

export interface UnapprovedWorkSummary {
  hasAlert: boolean;
  unapprovedCount: number;
  totalExposedCost: number;
  flaggedItems: VariationCostEntry[];
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Evaluasi Ring-Fenced Project Cashflow:
 * Membandingkan kas masuk proyek (DP + Termin + Dropping HQ) terhadap pengeluaran aktual & pending
 * agar PM tidak terus menyedot kas kantor pusat tanpa kontrol.
 */
export function evaluateRingFencedCashflow(
  input: RingFencedCashflowInput
): RingFencedCashflowResult {
  const clientInflow = Math.max(0, toNum(input.clientInflow));
  const hqDropping = Math.max(0, toNum(input.hqDropping));
  const actualOutflow = Math.max(0, toNum(input.actualOutflow));
  const pendingOutflow = Math.max(0, toNum(input.pendingOutflow));
  const requestedOutflow = Math.max(0, toNum(input.requestedOutflow));
  const ringFencedEnabled = input.ringFencedEnabled !== false;
  const hqDroppingLimit = Math.max(0, toNum(input.hqDroppingLimit));

  const totalInflow = clientInflow + hqDropping;
  const totalCommittedOutflow = actualOutflow + pendingOutflow;
  const currentBalance = totalInflow - totalCommittedOutflow;
  const projectedBalance = currentBalance - requestedOutflow;
  const deficitAmount = projectedBalance < 0 ? Math.abs(projectedBalance) : 0;

  if (projectedBalance >= 0) {
    const tight = totalInflow > 0 && projectedBalance / totalInflow < 0.15;
    return {
      totalInflow,
      totalCommittedOutflow,
      currentBalance,
      projectedBalance,
      deficitAmount: 0,
      allowed: true,
      requiresHqDropping: false,
      status: tight ? 'TIGHT' : 'SURPLUS',
      message: tight
        ? 'Saldo kas mandiri proyek menipis (< 15% dari total kas masuk).'
        : 'Kas mandiri proyek surplus dan sehat.',
    };
  }

  // Proyeksi defisit
  if (!ringFencedEnabled || deficitAmount <= hqDroppingLimit) {
    return {
      totalInflow,
      totalCommittedOutflow,
      currentBalance,
      projectedBalance,
      deficitAmount,
      allowed: true,
      requiresHqDropping: true,
      status: 'DEFICIT_WITH_DROPPING',
      message: `Kas proyek defisit Rp ${Math.round(deficitAmount).toLocaleString('id-ID')}, masih dalam plafon Dropping Kantor Pusat (Rp ${Math.round(hqDroppingLimit).toLocaleString('id-ID')}).`,
    };
  }

  return {
    totalInflow,
    totalCommittedOutflow,
    currentBalance,
    projectedBalance,
    deficitAmount,
    allowed: false,
    requiresHqDropping: true,
    status: 'DEFICIT_BLOCKED',
    message: `Ring-Fenced Cashflow Alert: Pengeluaran menyebabkan defisit kas Rp ${Math.round(deficitAmount).toLocaleString('id-ID')} (melebihi plafon Dropping HQ). Tagih termin klien atau ajukan Dropping Pusat terlebih dahulu.`,
  };
}

/**
 * Evaluasi countdown jatuh tempo Bank Garansi maupun Retensi Proyek.
 */
export function evaluateGuaranteeAndRetentionAlert(
  expiryDateStr: string | null | undefined,
  referenceDate: Date = new Date()
): ExpiryAlertResult {
  if (!expiryDateStr) {
    return {
      daysRemaining: 999,
      severity: 'SAFE',
      label: 'Belum Dijadwalkan',
      requiresAction: false,
    };
  }

  const target = new Date(expiryDateStr);
  if (Number.isNaN(target.getTime())) {
    return {
      daysRemaining: 999,
      severity: 'SAFE',
      label: 'Tanggal Tidak Valid',
      requiresAction: false,
    };
  }

  const startOfRef = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfRef.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      daysRemaining: diffDays,
      severity: 'EXPIRED',
      label: `Kedaluwarsa ${Math.abs(diffDays)} hari lalu`,
      requiresAction: true,
    };
  }
  if (diffDays <= 7) {
    return {
      daysRemaining: diffDays,
      severity: 'CRITICAL_7D',
      label: `Kritis: H-${diffDays} hari`,
      requiresAction: true,
    };
  }
  if (diffDays <= 14) {
    return {
      daysRemaining: diffDays,
      severity: 'WARNING_14D',
      label: `Segera Berakhir: H-${diffDays} hari`,
      requiresAction: true,
    };
  }
  if (diffDays <= 30) {
    return {
      daysRemaining: diffDays,
      severity: 'UPCOMING_30D',
      label: `Perhatian: H-${diffDays} hari`,
      requiresAction: true,
    };
  }

  return {
    daysRemaining: diffDays,
    severity: 'SAFE',
    label: `Aman (${diffDays} hari lagi)`,
    requiresAction: false,
  };
}

/**
 * Progress Billing Otomatis Berbasis BAKP:
 * Menghitung bobot progres tertimbang dari WBS (`SUM(progress * cost) / SUM(cost)`),
 * delta progres terhadap termin sebelumnya, DPP Gross, potongan Retensi, PPN, dan Net Tagihan.
 */
export function computeBakpProgressBilling(params: {
  wbsTasks: WbsProgressItem[];
  contractValue: number;
  previousProgressPct: number;
  retentionPct?: number;
  ppnPct?: number;
}): BakpBillingResult {
  const leafTasks = (params.wbsTasks || []).filter(
    (t) => String(t.summary || 'No').toLowerCase() !== 'yes'
  );
  const sourceTasks = leafTasks.length > 0 ? leafTasks : params.wbsTasks || [];

  const totalCost = sourceTasks.reduce((sum, t) => sum + Math.max(0, toNum(t.cost)), 0);
  const weightedNumerator = sourceTasks.reduce(
    (sum, t) => sum + Math.max(0, toNum(t.cost)) * Math.min(100, Math.max(0, toNum(t.progressPercent))),
    0
  );

  const weightedActualProgressPct =
    totalCost > 0 ? Math.round((weightedNumerator / totalCost) * 100) / 100 : 0;
  const previousProgressPct = Math.min(100, Math.max(0, toNum(params.previousProgressPct)));
  const deltaProgressPct = Math.max(
    0,
    Math.round((weightedActualProgressPct - previousProgressPct) * 100) / 100
  );

  const contractValue = Math.max(0, toNum(params.contractValue));
  const retentionPct = Math.max(0, toNum(params.retentionPct ?? 5));
  const ppnPct = Math.max(0, toNum(params.ppnPct ?? 11));

  const grossAmount = Math.round((contractValue * deltaProgressPct) / 100);
  const retentionAmount = Math.round((grossAmount * retentionPct) / 100);
  const netDpp = grossAmount - retentionAmount;
  const ppnAmount = Math.round((netDpp * ppnPct) / 100);
  const netBillableAmount = netDpp + ppnAmount;

  return {
    weightedActualProgressPct,
    previousProgressPct,
    deltaProgressPct,
    grossAmount,
    retentionAmount,
    ppnAmount,
    netBillableAmount,
  };
}

/**
 * Deteksi Pekerjaan Tambah Tanpa Addendum/SPK Resmi (Unapproved Work Alert).
 */
export function evaluateUnapprovedVariationWork(
  entries: VariationCostEntry[]
): UnapprovedWorkSummary {
  const flaggedItems = (entries || []).filter((e) => {
    const isVar = Boolean(e.isVariationWork);
    const status = String(e.ccoStatus || 'NO_CCO').toUpperCase();
    const isOfficiallyApproved = status === 'SIGNED' || status === 'APPROVED';
    return isVar && !isOfficiallyApproved && toNum(e.incurredCost) > 0;
  });

  const totalExposedCost = flaggedItems.reduce((sum, e) => sum + toNum(e.incurredCost), 0);

  return {
    hasAlert: flaggedItems.length > 0,
    unapprovedCount: flaggedItems.length,
    totalExposedCost: Math.round(totalExposedCost * 100) / 100,
    flaggedItems,
  };
}
