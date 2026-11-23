import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type CashFlowType = 'INFLOW' | 'OUTFLOW';

export type CostCategory =
  | 'MATERIAL'
  | 'LABOR'
  | 'SUBCONTRACTOR'
  | 'EQUIPMENT'
  | 'OVERHEAD'
  | 'TERMIN_IN'
  | 'OTHER';

export interface CashFlowRecord {
  id: string;
  project_id: string;
  type: CashFlowType;
  category: CostCategory | string;
  transaction_date: string;
  amount: number;
  description: string;
  payment_method?: string | null;
  reference_id?: string | null;
  reference_number?: string | null;
  is_deleted: boolean;
  voided_at?: string | null;
  void_reason?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ActualCostRecord {
  id: string;
  project_id: string;
  wbs_id?: string | null;
  rab_item_id?: string | null;
  category: CostCategory | string;
  cost_date: string;
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  description: string;
  vendor_name?: string | null;
  reference_id?: string | null;
  reference_number?: string | null;
  is_deleted: boolean;
  voided_at?: string | null;
  void_reason?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FinanceQueryOptions {
  includeVoid?: boolean;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export interface CategoryCostSummary {
  category: string;
  total_actual: number;
  transaction_count: number;
  percentage_of_total: number;
}

export interface MonthlyCashFlowPoint {
  month: string; // Format: YYYY-MM
  inflow: number;
  outflow: number;
  net_cash_flow: number;
  cumulative_balance: number;
}

export interface ProjectFinancialSummary {
  project_id: string;
  total_inflow: number;
  total_outflow: number;
  net_cash_balance: number;
  total_actual_cost: number; // ACWP aktif (non-void)
  subcontractor_actual_cost: number;
  subcontractor_outflow: number;
  voided_transactions_count: number;
  voided_total_amount: number;
  category_breakdown: CategoryCostSummary[];
  monthly_trend: MonthlyCashFlowPoint[];
}

// ============================================================================
// 1. CASH FLOWS (ARUS KAS PROYEK)
// ============================================================================

export async function getCashFlows(
  projectId: string,
  options?: FinanceQueryOptions
): Promise<CashFlowRecord[]> {
  let query = supabase
    .from('cash_flows')
    .select('*')
    .eq('project_id', projectId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Secara default mengecualikan transaksi yang di-VOID / Soft Delete
  if (!options?.includeVoid) {
    query = query.eq('is_deleted', false).is('voided_at', null);
  }

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  if (options?.startDate) {
    query = query.gte('transaction_date', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('transaction_date', options.endDate);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Gagal memuat data arus kas (cash_flows): ${error.message}`);
  }

  return (data ?? []) as CashFlowRecord[];
}

export async function createCashFlow(
  payload: Omit<
    CashFlowRecord,
    'id' | 'is_deleted' | 'voided_at' | 'void_reason' | 'created_at' | 'updated_at'
  >
): Promise<CashFlowRecord> {
  const { data, error } = await supabase
    .from('cash_flows')
    .insert({
      ...payload,
      is_deleted: false,
      voided_at: null,
      void_reason: null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal mencatat transaksi arus kas: ${error.message}`);
  }

  return data as CashFlowRecord;
}

export async function voidCashFlow(
  cashFlowId: string,
  reason = 'Dibatalkan oleh pengguna'
): Promise<void> {
  const now = new Date().toISOString();
  const cleanReason = reason.trim() || 'Dibatalkan oleh pengguna';

  const { error } = await supabase
    .from('cash_flows')
    .update({
      is_deleted: true,
      voided_at: now,
      void_reason: cleanReason,
      updated_at: now,
    })
    .eq('id', cashFlowId);

  if (error) {
    throw new Error(`Gagal melakukan VOID pada arus kas: ${error.message}`);
  }
}

// ============================================================================
// 2. ACTUAL COSTS (REALISASI BIAYA RAP / RAB / ACWP)
// ============================================================================

export async function getActualCosts(
  projectId: string,
  options?: FinanceQueryOptions
): Promise<ActualCostRecord[]> {
  let query = supabase
    .from('actual_costs')
    .select('*')
    .eq('project_id', projectId)
    .order('cost_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Secara default mengecualikan realisasi biaya yang di-VOID / Soft Delete
  if (!options?.includeVoid) {
    query = query.eq('is_deleted', false).is('voided_at', null);
  }

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  if (options?.startDate) {
    query = query.gte('cost_date', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('cost_date', options.endDate);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Gagal memuat realisasi biaya (actual_costs): ${error.message}`);
  }

  return (data ?? []) as ActualCostRecord[];
}

export async function createActualCost(
  payload: Omit<
    ActualCostRecord,
    'id' | 'is_deleted' | 'voided_at' | 'void_reason' | 'created_at' | 'updated_at'
  >
): Promise<ActualCostRecord> {
  const { data, error } = await supabase
    .from('actual_costs')
    .insert({
      ...payload,
      is_deleted: false,
      voided_at: null,
      void_reason: null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal mencatat realisasi biaya: ${error.message}`);
  }

  return data as ActualCostRecord;
}

export async function voidActualCost(
  actualCostId: string,
  reason = 'Dibatalkan oleh pengguna'
): Promise<void> {
  const now = new Date().toISOString();
  const cleanReason = reason.trim() || 'Dibatalkan oleh pengguna';

  const { error } = await supabase
    .from('actual_costs')
    .update({
      is_deleted: true,
      voided_at: now,
      void_reason: cleanReason,
      updated_at: now,
    })
    .eq('id', actualCostId);

  if (error) {
    throw new Error(`Gagal melakukan VOID pada realisasi biaya: ${error.message}`);
  }
}

// ============================================================================
// 3. SINKRONISASI PEMBATALAN BERDASARKAN REFERENCE_ID (FALLBACK / NON-RPC)
// ============================================================================

export async function syncVoidByReferenceId(
  referenceId: string,
  reason = 'Sinkronisasi pembatalan lintas modul'
): Promise<void> {
  const now = new Date().toISOString();
  const cleanReason = reason.trim() || 'Sinkronisasi pembatalan lintas modul';

  const [cfRes, acRes] = await Promise.all([
    supabase
      .from('cash_flows')
      .update({
        is_deleted: true,
        voided_at: now,
        void_reason: cleanReason,
        updated_at: now,
      })
      .eq('reference_id', referenceId)
      .is('voided_at', null),
    supabase
      .from('actual_costs')
      .update({
        is_deleted: true,
        voided_at: now,
        void_reason: cleanReason,
        updated_at: now,
      })
      .eq('reference_id', referenceId)
      .is('voided_at', null),
  ]);

  if (cfRes.error) {
    throw new Error(`Gagal sinkron VOID pada cash_flows: ${cfRes.error.message}`);
  }
  if (acRes.error) {
    throw new Error(`Gagal sinkron VOID pada actual_costs: ${acRes.error.message}`);
  }
}

// ============================================================================
// 4. REKAPITULASI KEUANGAN PROYEK, ACWP & ARUS KAS BULANAN
// ============================================================================

export async function getProjectFinancialSummary(
  projectId: string
): Promise<ProjectFinancialSummary> {
  const [allCashFlows, allActualCosts] = await Promise.all([
    getCashFlows(projectId, { includeVoid: true }),
    getActualCosts(projectId, { includeVoid: true }),
  ]);

  const activeCashFlows = allCashFlows.filter(
    (item) => !item.is_deleted && !item.voided_at
  );
  const voidedCashFlows = allCashFlows.filter(
    (item) => item.is_deleted || Boolean(item.voided_at)
  );

  const activeActualCosts = allActualCosts.filter(
    (item) => !item.is_deleted && !item.voided_at
  );
  const voidedActualCosts = allActualCosts.filter(
    (item) => item.is_deleted || Boolean(item.voided_at)
  );

  let totalInflow = 0;
  let totalOutflow = 0;
  let subcontractorOutflow = 0;

  const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

  for (const cf of activeCashFlows) {
    const amount = Number(cf.amount) || 0;
    const monthKey = (cf.transaction_date || '').slice(0, 7) || 'UNKNOWN';

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { inflow: 0, outflow: 0 });
    }
    const bucket = monthlyMap.get(monthKey)!;

    if (cf.type === 'INFLOW') {
      totalInflow += amount;
      bucket.inflow += amount;
    } else {
      totalOutflow += amount;
      bucket.outflow += amount;
      if (cf.category === 'SUBCONTRACTOR') {
        subcontractorOutflow += amount;
      }
    }
  }

  let totalActualCost = 0;
  let subcontractorActualCost = 0;
  const categoryMap = new Map<string, { total: number; count: number }>();

  for (const ac of activeActualCosts) {
    const amount = Number(ac.amount) || 0;
    const cat = ac.category || 'OTHER';

    totalActualCost += amount;
    if (cat === 'SUBCONTRACTOR') {
      subcontractorActualCost += amount;
    }

    const current = categoryMap.get(cat) ?? { total: 0, count: 0 };
    categoryMap.set(cat, {
      total: current.total + amount,
      count: current.count + 1,
    });
  }

  const categoryBreakdown: CategoryCostSummary[] = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      total_actual: stats.total,
      transaction_count: stats.count,
      percentage_of_total:
        totalActualCost > 0
          ? Number(((stats.total / totalActualCost) * 100).toFixed(2))
          : 0,
    }))
    .sort((a, b) => b.total_actual - a.total_actual);

  const sortedMonths = Array.from(monthlyMap.keys()).sort();
  let runningBalance = 0;
  const monthlyTrend: MonthlyCashFlowPoint[] = sortedMonths.map((month) => {
    const { inflow, outflow } = monthlyMap.get(month)!;
    const net = inflow - outflow;
    runningBalance += net;
    return {
      month,
      inflow,
      outflow,
      net_cash_flow: net,
      cumulative_balance: runningBalance,
    };
  });

  const voidedTotalAmount =
    voidedCashFlows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) +
    voidedActualCosts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return {
    project_id: projectId,
    total_inflow: totalInflow,
    total_outflow: totalOutflow,
    net_cash_balance: totalInflow - totalOutflow,
    total_actual_cost: totalActualCost,
    subcontractor_actual_cost: subcontractorActualCost,
    subcontractor_outflow: subcontractorOutflow,
    voided_transactions_count: voidedCashFlows.length + voidedActualCosts.length,
    voided_total_amount: voidedTotalAmount,
    category_breakdown: categoryBreakdown,
    monthly_trend: monthlyTrend,
  };
}