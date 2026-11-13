import { supabase } from '@/lib/supabase';

// ==========================================
// 1. TYPE DEFINITIONS
// ==========================================
export interface FuelTransactionInput { 
  project_id: string; tank_id: string; equipment_id?: string; transaction_type: 'IN' | 'OUT'; 
  quantity_liter: number; price_per_liter?: number; hm_recorded?: number; 
  work_load_type?: 'Low' | 'Medium' | 'High' | 'Idle'; created_by: string; transaction_date?: string; 
}
export interface VendorPayload { project_id: string; name: string; contact_person?: string; phone?: string; address?: string; bank_name?: string; bank_account_number?: string; bank_account_name?: string; }
export interface EquipmentUnitPayload { 
  project_id: string; category_id: string; unit_code: string; initial_hm: number; current_hm: number; 
  initial_fuel: number; current_fuel: number; is_active: boolean; 
  custom_rate_low?: number | null; custom_rate_medium?: number | null; custom_rate_high?: number | null; 
}

export interface ContractConfig {
  id: string; contract_number: string; rental_basis: 'Hourly' | 'Daily'; contract_quota: number;
  daily_normal_hours_limit: number; rate_per_hour: number; overtime_rate: number;
  overtime_deducts_quota: boolean; fuel_deduction_policy: 'Vendor' | 'Client';
  equipment_categories?: { name: string };
}

export interface EquipmentContractPayload {
  project_id: string; contract_number: string; vendor_name: string; category_id: string;
  rental_basis: 'Hourly' | 'Daily'; contract_quota: number; daily_normal_hours_limit: number;
  overtime_deducts_quota: boolean; rate_per_hour: number; overtime_rate: number;
  mob_demob_cost: number; start_date: string; end_date: string; is_active: boolean; fuel_deduction_policy: 'Vendor' | 'Client';
}

export interface BillableResult {
  regular_volume: number; overtime_volume: number; regular_amount: number; overtime_amount: number; billing_amount: number; quota_deduction: number; status_text: string;
}

export interface BarCalculationItem {
  timesheet_id: string | null; equipment_id: string; unit_code: string; log_date: string; actual_hours: number;
  regular_volume: number; overtime_volume: number; regular_amount: number; overtime_amount: number; billing_amount: number; fuel_liters: number; notes: string;
}

export interface BarCalculationResult {
  contract: ContractConfig; period_start: string; period_end: string; total_actual_hours: number;
  total_regular_volume: number; total_overtime_volume: number; total_regular_amount: number; total_overtime_amount: number;
  total_billing_amount: number; total_quota_used: number; sisa_kuota_awal: number; sisa_kuota_akhir: number;
  total_fuel_deduction: number; total_fuel_liters: number; avg_daily_fuel: number; grand_total: number; items: BarCalculationItem[];
}

// ==========================================
// 2. MESIN KALKULASI SEWA ALAT
// ==========================================
export function calculateRentalBilling(workingHours: number, standbyHours: number, breakdownHours: number, contract: ContractConfig): BillableResult {
  const limit = contract.daily_normal_hours_limit || 8;
  let regularVol = 0; let overtimeVol = 0; let regularAmount = 0; let overtimeAmount = 0; let quotaUsed = 0; let status = '';

  if (workingHours === 0 && standbyHours === 0 && breakdownHours > 0) {
    return { regular_volume: 0, overtime_volume: 0, regular_amount: 0, overtime_amount: 0, billing_amount: 0, quota_deduction: 0, status_text: `Breakdown (${breakdownHours} Jam) - No Charge` };
  }
  if (workingHours === 0 && standbyHours > 0) {
    regularVol = 4; quotaUsed = 4; regularAmount = 4 * contract.rate_per_hour;
    return { regular_volume: regularVol, overtime_volume: 0, regular_amount: regularAmount, overtime_amount: 0, billing_amount: regularAmount, quota_deduction: quotaUsed, status_text: 'Standby Full Day (Potong 4 Jam)' };
  }

  const actualHours = workingHours + standbyHours;
  if (contract.rental_basis === 'Hourly') {
    regularVol = Math.min(actualHours, limit); overtimeVol = Math.max(0, actualHours - limit);
    if (contract.overtime_deducts_quota) {
      quotaUsed = actualHours; regularAmount = actualHours * contract.rate_per_hour; overtimeAmount = overtimeVol * (contract.overtime_rate - contract.rate_per_hour); status = 'Hourly (Lembur Potong Kuota)'; 
    } else {
      quotaUsed = regularVol; regularAmount = regularVol * contract.rate_per_hour; overtimeAmount = overtimeVol * contract.overtime_rate; status = 'Hourly (Lembur Terpisah)'; 
    }
  } else {
    const isOperational = actualHours > 0 ? 1 : 0; overtimeVol = Math.max(0, actualHours - limit);
    if (contract.overtime_deducts_quota) {
      const konversiHari = overtimeVol / limit; quotaUsed = isOperational + konversiHari; regularAmount = quotaUsed * contract.rate_per_hour; overtimeAmount = 0; status = 'Daily (Konversi Hari)';
    } else {
      quotaUsed = isOperational; regularAmount = isOperational * contract.rate_per_hour; overtimeAmount = overtimeVol * contract.overtime_rate; status = 'Daily (Lembur Terpisah)'; 
    }
    regularVol = isOperational;
  }
  const billingAmount = regularAmount + overtimeAmount;
  return { regular_volume: regularVol, overtime_volume: overtimeVol, regular_amount: regularAmount, overtime_amount: overtimeAmount, billing_amount: billingAmount, quota_deduction: quotaUsed, status_text: status };
}

// ==========================================
// 3. BBM & DYNAMIC RATE
// ==========================================
export function getDynamicRate(equipment: any, workLoad: string) {
  const cat = equipment.equipment_categories;
  if (!cat) return 0;
  if (workLoad === 'Low') return equipment.custom_rate_low ?? cat.rate_low;
  if (workLoad === 'Medium') return equipment.custom_rate_medium ?? cat.rate_medium;
  if (workLoad === 'High') return equipment.custom_rate_high ?? cat.rate_high;
  return cat.rate_idle;
}

// 🟢 PERBAIKAN: Sisa BBM dibiarkan minus (tanpa Math.max(0, ...))
export async function getFuelHistory(projectId: string) {
  const { data: fuelData, error: err1 } = await supabase.from('fuel_transactions')
    .select(`*, fuel_tanks (tank_name), equipment_units (unit_code, category_id, initial_fuel, equipment_categories(name, capacity_tank_liter, rate_low, rate_medium, rate_high, rate_idle))`)
    .eq('project_id', projectId).eq('transaction_type', 'OUT').eq('is_deleted', false)
    .order('transaction_date', { ascending: true }).order('created_at', { ascending: true });
  if (err1) throw new Error(err1.message);
  if (!fuelData) return [];

  const { data: tsData } = await supabase.from('equipment_timesheets')
    .select('equipment_id, log_date, working_hours, standby_hours, work_load_type, status')
    .eq('project_id', projectId).eq('status', 'Approved').eq('is_deleted', false);

  const eventsByEq = new Map<string, any[]>();

  (tsData || []).forEach(ts => {
    if (!eventsByEq.has(ts.equipment_id)) eventsByEq.set(ts.equipment_id, []);
    eventsByEq.get(ts.equipment_id)!.push({ type: 'TIMESHEET', date: ts.log_date, data: ts });
  });

  fuelData.forEach(f => {
    if (!eventsByEq.has(f.equipment_id)) eventsByEq.set(f.equipment_id, []);
    eventsByEq.get(f.equipment_id)!.push({ type: 'FUEL', date: f.transaction_date, data: f });
  });

  const fuelWithBalance = fuelData.map(f => ({ ...f, fuel_balance: 0 }));

  eventsByEq.forEach((events, eqId) => {
    events.sort((a, b) => {
      if (a.date !== b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
      return a.type === 'TIMESHEET' ? -1 : 1;
    });

    const eq = fuelData.find(f => f.equipment_id === eqId)?.equipment_units as any;
    if (!eq) return;

    let balance = eq.initial_fuel || 0;
    const capacity = eq.equipment_categories?.capacity_tank_liter || 1000;

    events.forEach(ev => {
      if (ev.type === 'TIMESHEET') {
        const ts = ev.data;
        const wH = Number(ts.working_hours || 0);
        const idleH = Number(ts.standby_hours || 0);
        const workLoad = ts.work_load_type || 'Medium';
        const cat = eq.equipment_categories;
        
        let rateWork = cat?.rate_medium || 10;
        if (workLoad === 'Low') rateWork = cat?.rate_low || 8;
        if (workLoad === 'High') rateWork = cat?.rate_high || 15;
        const rateIdle = cat?.rate_idle || 4;

        const usage = (wH * rateWork) + (idleH * rateIdle);
        balance = balance - usage; // Dibiarkan minus
      } else {
        const fuelTrx = ev.data;
        const refuel = Number(fuelTrx.quantity_liter || 0);
        balance = Math.min(capacity, balance + refuel); // Batas maksimal kapasitas tetap
        
        const target = fuelWithBalance.find(f => f.id === fuelTrx.id);
        if (target) target.fuel_balance = balance;
      }
    });
  });

  return fuelWithBalance; 
}

export async function processFuelTransaction(input: FuelTransactionInput) {
  const { data: tank } = await supabase.from('fuel_tanks').select('*').eq('id', input.tank_id).single();
  if (!tank) throw new Error("Tangki tidak ditemukan");
  
  if (input.transaction_type === 'IN') {
    const { error } = await supabase.from('fuel_transactions').insert({ ...input });
    if (error) throw error;
    await supabase.from('fuel_tanks').update({ current_stock_liter: tank.current_stock_liter + input.quantity_liter }).eq('id', tank.id);
    return { success: true, message: 'Penerimaan BBM berhasil dicatat.' };
  } else {
    const { data: eq } = await supabase.from('equipment_units').select('*, equipment_categories(*)').eq('id', input.equipment_id).single();
    if (!eq) throw new Error("Alat tidak ditemukan");
    
    if (input.hm_recorded && input.hm_recorded < eq.current_hm) {
        throw new Error(`HM yang diinput (${input.hm_recorded}) lebih kecil dari HM terakhir (${eq.current_hm}).`);
    }

    const jamKerja = input.hm_recorded ? (input.hm_recorded - eq.current_hm) : 0;
    let isAnomaly = false; let anomalyReason: string | null = null;
    if (jamKerja > 0 && input.work_load_type) {
      const standardRate = getDynamicRate(eq, input.work_load_type);
      const rasioAktual = input.quantity_liter / jamKerja;
      if (rasioAktual > (standardRate * 1.2)) { isAnomaly = true; anomalyReason = `Rasio ${rasioAktual.toFixed(2)} L/jam melebihi standar (${standardRate} L/jam).`; }
    }

    const { error: trxError } = await supabase.from('fuel_transactions').insert({ ...input, is_anomaly: isAnomaly, anomaly_reason: anomalyReason });
    if (trxError) throw trxError;
    
    await supabase.from('fuel_tanks').update({ current_stock_liter: tank.current_stock_liter - input.quantity_liter }).eq('id', tank.id);
    
    const newEqFuel = Math.min(eq.equipment_categories.capacity_tank_liter, (eq.current_fuel || 0) + input.quantity_liter);
    await supabase.from('equipment_units').update({ current_fuel: newEqFuel }).eq('id', eq.id);
    
    return { success: true, isAnomaly, anomalyReason, message: isAnomaly ? 'BBM dicatat, namun ditandai ANOMALI.' : 'Pengisian BBM berhasil.' };
  }
}

export async function updateFuelTransaction(id: string, payload: any, oldLiters: number, tankId: string) {
  const { error: trxErr } = await supabase.from('fuel_transactions').update(payload).eq('id', id);
  if (trxErr) throw new Error(trxErr.message);
  return true;
}

export async function voidFuelTransaction(id: string, tankId: string, liters: number) {
  const { error: trxErr } = await supabase.from('fuel_transactions').update({ is_deleted: true }).eq('id', id);
  if (trxErr) throw new Error(trxErr.message);
  const { data: tank } = await supabase.from('fuel_tanks').select('current_stock_liter').eq('id', tankId).single();
  if (tank) await supabase.from('fuel_tanks').update({ current_stock_liter: tank.current_stock_liter + liters }).eq('id', tankId);
  return true;
}

// ==========================================
// 4. TIMESHEET
// ==========================================
export async function saveDailyTimesheet(payload: any) {
  const { data, error } = await supabase.from('equipment_timesheets').insert(payload).select().single();
  if (error) throw new Error(error.message);
  
  if (payload.equipment_id) {
    const { data: eq } = await supabase.from('equipment_units').select('*, equipment_categories(*)').eq('id', payload.equipment_id).single();
    if (eq) {
      if (payload.hm_end) {
        await supabase.from('equipment_units').update({ current_hm: payload.hm_end }).eq('id', payload.equipment_id);
      }

      const workHours = Number(payload.working_hours || 0);
      const idleHours = Number(payload.standby_hours || 0);
      const rateWork = getDynamicRate(eq, payload.work_load_type || 'Medium');
      const rateIdle = eq.equipment_categories?.rate_idle || 4;

      const usageWork = workHours * rateWork;
      const usageIdle = idleHours * rateIdle;
      const totalUsage = usageWork + usageIdle;

      const currentFuel = eq.current_fuel || 0;
      const newFuel = currentFuel - totalUsage; // Dibiarkan minus
      await supabase.from('equipment_units').update({ current_fuel: newFuel }).eq('id', eq.id);
    }
  }
  return data;
}

export async function updateTimesheet(id: string, payload: any) {
  const { data, error } = await supabase.from('equipment_timesheets').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function voidTimesheet(id: string) {
  const { error } = await supabase.from('equipment_timesheets').update({ status: 'Void', is_deleted: true }).eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function approveTimesheet(id: string) {
  const { data, error } = await supabase.from('equipment_timesheets').update({ status: 'Approved' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getTimesheetHistory(projectId: string) {
  const { data: tsData, error: tsErr } = await supabase.from('equipment_timesheets')
    .select(`*, equipment_units (unit_code, initial_fuel, equipment_categories(rate_low, rate_medium, rate_high, rate_idle)), equipment_contracts (*)`)
    .eq('project_id', projectId).eq('is_deleted', false)
    .order('log_date', { ascending: true });
  if (tsErr) throw new Error(tsErr.message);

  const { data: fuelData } = await supabase.from('fuel_transactions')
    .select('*').eq('project_id', projectId).eq('transaction_type', 'OUT').eq('is_deleted', false);

  const eventsByEq = new Map<string, any[]>();
  const tsMap = new Map<string, any>(); 

  (tsData || []).forEach(ts => {
    if (!eventsByEq.has(ts.equipment_id)) eventsByEq.set(ts.equipment_id, []);
    eventsByEq.get(ts.equipment_id)!.push({ type: 'TIMESHEET', date: ts.log_date, data: ts });
    tsMap.set(ts.id, ts);
  });

  (fuelData || []).forEach(f => {
    if (!eventsByEq.has(f.equipment_id)) eventsByEq.set(f.equipment_id, []);
    eventsByEq.get(f.equipment_id)!.push({ type: 'FUEL', date: f.transaction_date, data: f });
  });

  eventsByEq.forEach((events, eqId) => {
    events.sort((a, b) => {
      if (a.date !== b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
      return a.type === 'TIMESHEET' ? -1 : 1; 
    });

    const eq = tsData?.find(ts => ts.equipment_id === eqId)?.equipment_units;
    if (!eq) return;

    let currentFuel = eq.initial_fuel || 0;
    const capacity = eq.equipment_categories?.capacity_tank_liter || 1000;

    events.forEach(ev => {
      if (ev.type === 'TIMESHEET') {
        const ts = ev.data;
        const wH = Number(ts.working_hours || 0);
        const idleH = Number(ts.standby_hours || 0);
        const workLoad = ts.work_load_type || 'Medium';
        const cat = eq.equipment_categories;

        let rateWork = cat?.rate_medium || 10;
        if (workLoad === 'Low') rateWork = cat?.rate_low || 8;
        if (workLoad === 'High') rateWork = cat?.rate_high || 15;
        const rateIdle = cat?.rate_idle || 4;

        const usage = (wH * rateWork) + (idleH * rateIdle);
        currentFuel = currentFuel - usage; // Dibiarkan minus

        const tsRef = tsMap.get(ts.id);
        if (tsRef) {
          tsRef.fuel_usage = usage;
          tsRef.fuel_balance = currentFuel;
          tsRef.fuel_refill = 0; 
        }
      } else if (ev.type === 'FUEL') {
        const fuel = ev.data;
        const refuel = Number(fuel.quantity_liter || 0);
        currentFuel = Math.min(capacity, currentFuel + refuel);

        const sameDayTs = Array.from(tsMap.values()).find(t => t.equipment_id === eqId && t.log_date === fuel.transaction_date);
        if (sameDayTs) {
          sameDayTs.fuel_refill = (sameDayTs.fuel_refill || 0) + refuel;
          sameDayTs.fuel_balance = currentFuel; 
        }
      }
    });
  });

  return Array.from(tsMap.values()).sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
}

// ==========================================
// 5. BERITA ACARA REKONSILIASI (BAR)
// ==========================================
export async function generateBarData(contractId: string, periodStart: string, periodEnd: string): Promise<BarCalculationResult> {
  const { data: contractData, error: contractErr } = await supabase.from('equipment_contracts').select('*').eq('id', contractId).single();
  if (contractErr || !contractData) throw new Error("Kontrak tidak ditemukan.");
  
  const { data: catData } = await supabase.from('equipment_categories').select('name').eq('id', contractData.category_id).single();
  const contract = { ...contractData, equipment_categories: { name: catData?.name || '-' } } as ContractConfig;
  
  const { data: timesheets, error: tsErr } = await supabase.from('equipment_timesheets')
    .select(`id, equipment_id, log_date, working_hours, standby_hours, breakdown_hours, equipment_units!inner(unit_code)`)
    .eq('contract_id', contractId).eq('is_deleted', false).eq('status', 'Approved')
    .gte('log_date', periodStart).lte('log_date', periodEnd).order('log_date', { ascending: true });
  if (tsErr) throw new Error("Gagal mengambil data timesheet.");
  
  const { data: prevTimesheets } = await supabase.from('equipment_timesheets').select(`working_hours, standby_hours, breakdown_hours`).eq('contract_id', contractId).eq('is_deleted', false).eq('status', 'Approved').lt('log_date', periodStart);
  let sisaKuotaAwal = contract.contract_quota;
  (prevTimesheets || []).forEach(ts => {
    const res = calculateRentalBilling(Number(ts.working_hours || 0), Number(ts.standby_hours || 0), Number(ts.breakdown_hours || 0), contract);
    sisaKuotaAwal -= res.quota_deduction;
  });

  const dailyData: Record<string, { ts: any | null, fuel_liters: number }> = {};
  (timesheets || []).forEach(ts => { dailyData[ts.log_date] = { ts, fuel_liters: 0 }; });

  let totalFuelLiters = 0; let totalFuelDeduction = 0; const uniqueBbmDates = new Set<string>();
  const equipmentIds = [...new Set((timesheets || []).map((t: any) => t.equipment_id))];
  
  if (equipmentIds.length > 0) {
    const { data: fuelData } = await supabase.from('fuel_transactions').select('equipment_id, transaction_date, quantity_liter, price_per_liter, equipment_units(unit_code)').in('equipment_id', equipmentIds).gte('transaction_date', periodStart).lte('transaction_date', periodEnd).eq('transaction_type', 'OUT').eq('is_deleted', false);
    (fuelData || []).forEach(f => {
      const liters = Number(f.quantity_liter); const price = Number(f.price_per_liter || 0);
      totalFuelLiters += liters; totalFuelDeduction += (liters * price); uniqueBbmDates.add(f.transaction_date);
      if (!dailyData[f.transaction_date]) dailyData[f.transaction_date] = { ts: { equipment_id: f.equipment_id, equipment_units: f.equipment_units }, fuel_liters: 0 };
      dailyData[f.transaction_date].fuel_liters += liters;
    });
  }

  let items: BarCalculationItem[] = []; let totalActualHours = 0; let totalRegVol = 0; let totalOtVol = 0; let totalRegAmt = 0; let totalOtAmt = 0; let totalQuotaUsed = 0;
  const sortedDates = Object.keys(dailyData).sort();

  sortedDates.forEach(date => {
    const row = dailyData[date]; const ts = row.ts;
    if (ts && ts.working_hours !== undefined) {
      const wH = Number(ts.working_hours || 0); const sH = Number(ts.standby_hours || 0); const bH = Number(ts.breakdown_hours || 0); const actualH = wH + sH; 
      const res = calculateRentalBilling(wH, sH, bH, contract);
      items.push({ timesheet_id: ts.id, equipment_id: ts.equipment_id, unit_code: ts.equipment_units?.unit_code || 'Unknown', log_date: date, actual_hours: actualH, regular_volume: res.regular_volume, overtime_volume: res.overtime_volume, regular_amount: res.regular_amount, overtime_amount: res.overtime_amount, billing_amount: res.billing_amount, fuel_liters: row.fuel_liters, notes: res.status_text });
      totalActualHours += actualH; totalRegVol += res.regular_volume; totalOtVol += res.overtime_volume; totalRegAmt += res.regular_amount; totalOtAmt += res.overtime_amount; totalQuotaUsed += res.quota_deduction;
    } else {
      items.push({ timesheet_id: null, equipment_id: ts?.equipment_id, unit_code: ts?.equipment_units?.unit_code || 'Unknown', log_date: date, actual_hours: 0, regular_volume: 0, overtime_volume: 0, regular_amount: 0, overtime_amount: 0, billing_amount: 0, fuel_liters: row.fuel_liters, notes: 'Pengisian BBM (Tanpa Log Kerja)' });
    }
  });
  
  const totalBilling = totalRegAmt + totalOtAmt;
  const grandTotal = totalBilling - (contract.fuel_deduction_policy === 'Vendor' ? totalFuelDeduction : 0);
  const operationalDays = new Set((timesheets || []).map(t => t.log_date)).size;
  const divisorDays = Math.max(operationalDays, uniqueBbmDates.size, 1);
  const avgDailyFuel = totalFuelLiters / divisorDays;
  
  return { 
    contract, period_start: periodStart, period_end: periodEnd, total_actual_hours: totalActualHours, 
    total_regular_volume: totalRegVol, total_overtime_volume: totalOtVol, total_regular_amount: totalRegAmt, total_overtime_amount: totalOtAmt,
    total_billing_amount: totalBilling, total_quota_used: totalQuotaUsed, sisa_kuota_awal: sisaKuotaAwal, sisa_kuota_akhir: sisaKuotaAwal - totalQuotaUsed, 
    total_fuel_deduction: contract.fuel_deduction_policy === 'Vendor' ? totalFuelDeduction : 0, total_fuel_liters: totalFuelLiters, avg_daily_fuel: avgDailyFuel,
    grand_total: Math.max(0, grandTotal), items 
  };
}

export async function saveBarToDB(projectId: string, data: BarCalculationResult, userId: string) {
  const { data: barData, error: barErr } = await supabase.from('equipment_bars').insert({ project_id: projectId, contract_id: data.contract.id, period_start: data.period_start, period_end: data.period_end, total_actual_hours: data.total_actual_hours, total_billable_hours: data.total_regular_volume + data.total_overtime_volume, total_overtime_hours: data.total_overtime_volume, total_deduction_fuel: data.total_fuel_deduction, grand_total: data.grand_total, status: 'Draft', created_by: userId }).select().single();
  if (barErr) throw new Error(`Gagal menyimpan Header BAR: ${barErr.message}`);
  const barItems = data.items.filter(i => i.timesheet_id).map(item => ({ bar_id: barData.id, timesheet_id: item.timesheet_id, log_date: item.log_date, actual_hours: item.actual_hours, billable_hours: item.regular_volume + item.overtime_volume, overtime_hours: item.overtime_volume, notes: item.notes }));
  if(barItems.length > 0) {
      const { error: itemsErr } = await supabase.from('equipment_bar_items').insert(barItems);
      if (itemsErr) { await supabase.from('equipment_bars').delete().eq('id', barData.id); throw new Error(`Gagal menyimpan detail BAR: ${itemsErr.message}`); }
  }
  return barData;
}

// ==========================================
// 6. MASTER SERVICES
// ==========================================
export async function getEquipmentContracts(projectId: string) {
  const { data: contracts, error: contractErr } = await supabase.from('equipment_contracts').select('*').eq('project_id', projectId).eq('is_active', true).order('created_at', { ascending: false });
  if (contractErr) throw new Error(contractErr.message);
  if (!contracts || contracts.length === 0) return [];
  const { data: categories, error: catErr } = await supabase.from('equipment_categories').select('id, name');
  if (catErr) throw new Error(catErr.message);
  const catMap = new Map((categories || []).map(c => [c.id, c.name]));
  return contracts.map(c => ({ ...c, equipment_categories: { name: catMap.get(c.category_id) || '-' } }));
}
export async function saveEquipmentContract(payload: EquipmentContractPayload) {
  const { data, error } = await supabase.from('equipment_contracts').insert(payload).select().single();
  if (error) throw new Error(error.message); return data;
}
export async function updateEquipmentContract(id: string, payload: Partial<EquipmentContractPayload>) {
  const { data, error } = await supabase.from('equipment_contracts').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message); return data;
}
export async function softDeleteEquipmentContract(id: string) {
  const { error } = await supabase.from('equipment_contracts').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message); return true;
}
export async function getEquipmentCategories() {
  const { data, error } = await supabase.from('equipment_categories').select('id, name, capacity_tank_liter, rate_low, rate_medium, rate_high, rate_idle').order('name', { ascending: true });
  if (error) throw new Error(error.message); return data || [];
}
export async function getVendors(projectId: string) {
  const { data, error } = await supabase.from('vendors').select('id, name').eq('project_id', projectId).eq('is_active', true).order('name', { ascending: true });
  if (error) throw new Error(error.message); return data || [];
}
export async function saveVendor(payload: VendorPayload) {
  const { data, error } = await supabase.from('vendors').insert({ ...payload, is_active: true }).select().single();
  if (error) throw new Error(error.message); return data;
}
export async function updateVendor(id: string, payload: Partial<VendorPayload>) {
  const { data, error } = await supabase.from('vendors').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message); return data;
}
export async function softDeleteVendor(id: string) {
  const { error } = await supabase.from('vendors').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message); return true;
}
export async function getEquipmentUnits(projectId: string) {
  const { data, error } = await supabase.from('equipment_units').select(`*, equipment_categories(name, capacity_tank_liter, rate_low, rate_medium, rate_high, rate_idle)`).eq('project_id', projectId).eq('is_active', true);
  if (error) throw new Error(error.message); return data || [];
}
export async function saveEquipmentUnit(payload: EquipmentUnitPayload) {
  const { data, error } = await supabase.from('equipment_units').insert(payload).select().single();
  if (error) throw new Error(error.message); return data;
}
export async function updateEquipmentUnit(id: string, payload: Partial<EquipmentUnitPayload>) {
  const { data, error } = await supabase.from('equipment_units').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message); return data;
}
export async function softDeleteEquipmentUnit(id: string) {
  const { error } = await supabase.from('equipment_units').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message); return true;
}
export async function updateUnitFuelRates(id: string, rates: { custom_rate_low?: number, custom_rate_medium?: number, custom_rate_high?: number }) {
  const { data, error } = await supabase.from('equipment_units').update(rates).eq('id', id).select().single();
  if (error) throw new Error(error.message); return data;
}