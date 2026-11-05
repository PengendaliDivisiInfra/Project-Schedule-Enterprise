export interface CrewComposition {
  id: string;
  project_id: string | null;
  code: string;
  name: string;
  mandor_count: number;
  tukang_count: number;
  pekerja_count: number;
  capacity_per_day: number;
  unit: string;
  daily_cost: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CrewCompositionInput = Omit<
  CrewComposition,
  "id" | "created_at" | "updated_at"
>;

export interface ResourceRequirement {
  id?: string;
  task_id?: string;
  task_name?: string;
  resource_name: string;
  resource_type?: string;
  total_requirement: number;
  daily_requirement: number;
  unit: string;
  daily_cost?: number;
  capacity_per_day?: number;
  crew_composition_id?: string | null;
  remaining_volume?: number;
  remaining_days?: number;
}

export interface ResourceCostResult {
  teams_needed: number;
  remaining_days: number;
  daily_cost_per_team: number;
  remaining_cost: number;
  cost_per_unit: number;
  recommendation: "Normal" | "Lembur" | "Shift" | "Tambah Tim";
  is_lead_time_warning: boolean;
}

export interface ResourceCostSummary {
  total_remaining_cost: number;
  total_daily_cost: number;
  lead_time_warning_count: number;
  items: Array<ResourceRequirement & { cost: ResourceCostResult }>;
}