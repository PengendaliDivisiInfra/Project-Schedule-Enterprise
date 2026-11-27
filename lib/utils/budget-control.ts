// lib/utils/budget-control.ts

export type ApprovalDocumentType = 'PR' | 'PO' | 'KASBON' | 'CASH_OUT' | 'SPK';

export interface ThreeLayerBudgetInput {
  paguRab: number;
  committedPo?: number;
  committedSpk?: number;
  committedPendingCash?: number;
  actualCost?: number;
}

export interface ThreeLayerBudgetResult {
  paguRab: number;
  committedPo: number;
  committedSpk: number;
  committedPendingCash: number;
  committedBudget: number;
  actualCost: number;
  totalUsed: number;
  availableBudget: number;
  utilizationPct: number;
  committedPct: number;
  actualPct: number;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED';
}

export interface HardStopValidationResult {
  allowed: boolean;
  shortfall: number;
  remainingAfter: number;
  message: string;
}

export interface ApprovalRuleRecord {
  id?: string;
  project_id?: string | null;
  rule_name: string;
  document_type: ApprovalDocumentType;
  cost_category: string;
  min_amount: number;
  max_amount: number | null;
  approver_roles: string[];
  require_mfa: boolean;
  is_active: boolean;
  priority: number;
}

export interface ApprovalResolution {
  matchedRule: ApprovalRuleRecord | null;
  approverRoles: string[];
  totalSteps: number;
  requireMfa: boolean;
}

export interface TieredApprovalTransition {
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  nextStep: number;
  totalSteps: number;
  nextRequiredRole: string | null;
  isFinal: boolean;
}

const DEFAULT_FALLBACK_CHAIN = ['Project Manager'];

function toSafeNum(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export function calculateThreeLayerBudget(
  input: ThreeLayerBudgetInput
): ThreeLayerBudgetResult {
  const paguRab = Math.max(0, toSafeNum(input.paguRab));
  const committedPo = Math.max(0, toSafeNum(input.committedPo));
  const committedSpk = Math.max(0, toSafeNum(input.committedSpk));
  const committedPendingCash = Math.max(0, toSafeNum(input.committedPendingCash));
  const actualCost = Math.max(0, toSafeNum(input.actualCost));

  const committedBudget = committedPo + committedSpk + committedPendingCash;
  const totalUsed = committedBudget + actualCost;
  const availableBudget = paguRab - totalUsed;

  const utilizationPct = paguRab > 0 ? Math.round((totalUsed / paguRab) * 10000) / 100 : 0;
  const committedPct = paguRab > 0 ? Math.round((committedBudget / paguRab) * 10000) / 100 : 0;
  const actualPct = paguRab > 0 ? Math.round((actualCost / paguRab) * 10000) / 100 : 0;

  let status: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
  if (availableBudget < 0) {
    status = 'EXCEEDED';
  } else if (paguRab > 0 && utilizationPct >= 85) {
    status = 'WARNING';
  }

  return {
    paguRab,
    committedPo,
    committedSpk,
    committedPendingCash,
    committedBudget,
    actualCost,
    totalUsed,
    availableBudget,
    utilizationPct,
    committedPct,
    actualPct,
    status,
  };
}

export function validateHardStopBudget(
  availableBudget: number,
  requestedAmount: number,
  options?: { enforceHardStop?: boolean; paguRab?: number }
): HardStopValidationResult {
  const avail = toSafeNum(availableBudget);
  const req = Math.max(0, toSafeNum(requestedAmount));
  const enforce = options?.enforceHardStop !== false;
  const pagu = options?.paguRab;

  if (pagu !== undefined && pagu <= 0) {
    return {
      allowed: true,
      shortfall: 0,
      remainingAfter: avail - req,
      message: 'Pagu anggaran belum ditetapkan.',
    };
  }

  const remainingAfter = avail - req;
  const shortfall = remainingAfter < 0 ? Math.abs(remainingAfter) : 0;

  if (enforce && req > avail) {
    return {
      allowed: false,
      shortfall,
      remainingAfter,
      message: `Hard-Stop: Pengajuan melebihi Available Budget sebesar Rp ${Math.round(shortfall).toLocaleString('id-ID')}.`,
    };
  }

  return {
    allowed: true,
    shortfall,
    remainingAfter,
    message: 'Anggaran mencukupi (Available Budget valid).',
  };
}

export function resolveApprovalMatrix(
  rules: ApprovalRuleRecord[],
  query: {
    documentType: ApprovalDocumentType;
    costCategory?: string | null;
    amount: number;
    projectId?: string | null;
  }
): ApprovalResolution {
  const docType = String(query.documentType || 'CASH_OUT').toUpperCase();
  const category = String(query.costCategory || 'ALL').trim().toLowerCase();
  const amount = Math.max(0, toSafeNum(query.amount));
  const projectId = query.projectId || null;

  const candidates = (rules || []).filter((r) => {
    if (!r || r.is_active === false) return false;
    if (String(r.document_type || '').toUpperCase() !== docType) return false;

    const projectMatch = r.project_id === null || r.project_id === undefined || r.project_id === projectId;
    if (!projectMatch) return false;

    const rCat = String(r.cost_category || 'ALL').trim().toLowerCase();
    const catMatch = rCat === 'all' || rCat === category;
    if (!catMatch) return false;

    const minOk = amount >= toSafeNum(r.min_amount);
    const maxOk = r.max_amount === null || r.max_amount === undefined || amount <= toSafeNum(r.max_amount);
    return minOk && maxOk;
  });

  candidates.sort((a, b) => {
    const aProjScore = a.project_id && a.project_id === projectId ? 0 : 1;
    const bProjScore = b.project_id && b.project_id === projectId ? 0 : 1;
    if (aProjScore !== bProjScore) return aProjScore - bProjScore;

    const aCatScore = String(a.cost_category || 'ALL').toUpperCase() !== 'ALL' ? 0 : 1;
    const bCatScore = String(b.cost_category || 'ALL').toUpperCase() !== 'ALL' ? 0 : 1;
    if (aCatScore !== bCatScore) return aCatScore - bCatScore;

    const aPrio = toSafeNum(a.priority ?? 100);
    const bPrio = toSafeNum(b.priority ?? 100);
    if (aPrio !== bPrio) return aPrio - bPrio;

    return toSafeNum(b.min_amount) - toSafeNum(a.min_amount);
  });

  const matched = candidates[0] || null;
  const roles =
    matched && Array.isArray(matched.approver_roles) && matched.approver_roles.length > 0
      ? matched.approver_roles
      : DEFAULT_FALLBACK_CHAIN;

  return {
    matchedRule: matched,
    approverRoles: roles,
    totalSteps: roles.length,
    requireMfa: matched ? Boolean(matched.require_mfa) : true,
  };
}

function normApproverRole(role?: string | null): string {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'pm') return 'project manager';
  if (r === 'super_admin') return 'super admin';
  if (r === 'finance_manager') return 'finance manager';
  if (r === 'project_director') return 'project director';
  if (r === 'central_procurement') return 'central procurement';
  if (r === 'direktur utama' || r === 'dirut') return 'owner';
  return r;
}

export function canRoleApproveStep(
  requiredRole: string,
  actor: { globalRole?: string | null; projectRole?: string | null }
): boolean {
  const req = normApproverRole(requiredRole);
  const g = normApproverRole(actor.globalRole);
  const p = normApproverRole(actor.projectRole);

  if (g === 'auditor') return false;
  if (g === 'owner' || g === 'super admin' || p === 'owner') return true;

  if (req === 'project manager') {
    return p === 'project manager';
  }
  if (req === 'finance manager' || req === 'project director') {
    return g === 'finance manager' || g === 'project director';
  }
  if (req === 'central procurement') {
    return g === 'central procurement';
  }
  return g === req || p === req;
}

export function evaluateTieredApprovalStep(params: {
  chain: string[];
  currentStep: number;
  decision: 'APPROVED' | 'REJECTED';
}): TieredApprovalTransition {
  const safeChain =
    Array.isArray(params.chain) && params.chain.length > 0
      ? params.chain
      : DEFAULT_FALLBACK_CHAIN;
  const totalSteps = safeChain.length;
  const currStep = Math.min(Math.max(1, Math.floor(params.currentStep || 1)), totalSteps);

  if (params.decision === 'REJECTED') {
    return {
      approvalStatus: 'Rejected',
      nextStep: currStep,
      totalSteps,
      nextRequiredRole: null,
      isFinal: true,
    };
  }

  if (currStep < totalSteps) {
    const nextStep = currStep + 1;
    return {
      approvalStatus: 'Pending',
      nextStep,
      totalSteps,
      nextRequiredRole: safeChain[nextStep - 1] || null,
      isFinal: false,
    };
  }

  return {
    approvalStatus: 'Approved',
    nextStep: totalSteps,
    totalSteps,
    nextRequiredRole: null,
    isFinal: true,
  };
}
