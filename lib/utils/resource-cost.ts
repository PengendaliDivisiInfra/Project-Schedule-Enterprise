import type { ResourceRequirement, ResourceCostResult, ResourceCostSummary } from "@/types/resource-plan";

const LEAD_TIME_THRESHOLD_DAYS = 14;
const DEFAULT_CAPACITY_PER_DAY = 10;
const OVERTIME_RATIO_THRESHOLD = 1.2;
const SHIFT_RATIO_THRESHOLD = 2.0;

export function calculateResourceCost(req: ResourceRequirement): ResourceCostResult {
  const capacity = req.capacity_per_day && req.capacity_per_day > 0 ? req.capacity_per_day : DEFAULT_CAPACITY_PER_DAY;
  const dailyReq = Math.max(0, req.daily_requirement ?? 0);
  const teamsNeeded = Math.max(1, Math.ceil(dailyReq / capacity));
  const remainingVolume = req.remaining_volume ?? Math.max(0, req.total_requirement - dailyReq * 1);
  const remainingDays = req.remaining_days ?? (capacity > 0 ? Math.ceil(remainingVolume / (teamsNeeded * capacity)) : 0);
  const dailyCostPerTeam = Math.max(0, req.daily_cost ?? 0);
  const remainingCost = remainingDays * teamsNeeded * dailyCostPerTeam;
  const costPerUnit = remainingVolume > 0 ? remainingCost / remainingVolume : 0;

  const loadRatio = capacity > 0 ? dailyReq / capacity : 0;
  let recommendation: ResourceCostResult["recommendation"] = "Normal";
  if (loadRatio > SHIFT_RATIO_THRESHOLD) recommendation = "Shift";
  else if (loadRatio > OVERTIME_RATIO_THRESHOLD) recommendation = "Lembur";
  else if (teamsNeeded > 3) recommendation = "Tambah Tim";

  const isLeadTimeWarning = remainingDays < LEAD_TIME_THRESHOLD_DAYS && remainingVolume > 0;

  return { teams_needed: teamsNeeded, remaining_days: remainingDays, daily_cost_per_team: dailyCostPerTeam, remaining_cost: remainingCost, cost_per_unit: costPerUnit, recommendation, is_lead_time_warning: isLeadTimeWarning };
}

export function summarizeResourceCosts(requirements: ResourceRequirement[]): ResourceCostSummary {
  const items = requirements.map((req) => ({ ...req, cost: calculateResourceCost(req) }));
  return {
    total_remaining_cost: items.reduce((s, i) => s + i.cost.remaining_cost, 0),
    total_daily_cost: items.reduce((s, i) => s + i.cost.daily_cost_per_team * i.cost.teams_needed, 0),
    lead_time_warning_count: items.filter((i) => i.cost.is_lead_time_warning).length,
    items,
  };
}

export function formatRupiah(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "Rp0";
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(2)} M`;
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(2)} jt`;
  if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)} rb`;
  return `Rp${value.toFixed(0)}`;
}