import { supabase } from '@/lib/supabase';

// Tipe Data
export interface FuelTransactionInput {
  project_id: string;
  tank_id: string;
  equipment_id?: string;
  transaction_type: 'IN' | 'OUT';
  quantity_liter: number;
  price_per_liter?: number;
  hm_recorded?: number;
  work_load_type?: 'Low' | 'Medium' | 'High' | 'Idle';
  created_by: string;
}

// 1. Ambil Standar L/Jam Dinamis
export function getDynamicRate(category: any, workLoad: string) {
  if (workLoad === 'Low') return category.rate_low;
  if (workLoad === 'Medium') return category.rate_medium;
  if (workLoad === 'High') return category.rate_high;
  return category.rate_idle;
}

// 2. Proses Transaksi BBM dengan Validasi Ketat
export async function processFuelTransaction(input: FuelTransactionInput) {
  // A. Ambil Data Tangki & Alat
  const { data: tank } = await supabase.from('fuel_tanks').select('*').eq('id', input.tank_id).single();
  if (!tank) throw new Error("Tangki tidak ditemukan");

  if (input.transaction_type === 'IN') {
    // Skenario: Solar Masuk dari Supplier (DO)
    const { error } = await supabase.from('fuel_transactions').insert({ ...input });
    if (error) throw error;

    await supabase.from('fuel_tanks')
      .update({ current_stock_liter: tank.current_stock_liter + input.quantity_liter })
      .eq('id', tank.id);
      
    return { success: true, message: 'Penerimaan BBM berhasil dicatat.' };
  } 
  
  else {
    // Skenario: Pengisian ke Alat (OUT)
    const { data: eq } = await supabase.from('equipment_units')
      .select('*, equipment_categories(*)')
      .eq('id', input.equipment_id)
      .single();
    if (!eq) throw new Error("Alat tidak ditemukan");

    // Validasi 1: Overfill Protection (Cek Kapasitas Tangki Alat)
    // (Dalam aplikasi nyata, sisa virtual alat dihitung dulu)
    if (input.quantity_liter > eq.equipment_categories.capacity_tank_liter) {
      throw new Error(`Overfill! Kapasitas tangki alat hanya ${eq.equipment_categories.capacity_tank_liter} L.`);
    }

    // Validasi 2: Rasio Anti-Fraud (L/Jam)
    const jamKerja = input.hm_recorded ? (input.hm_recorded - eq.current_hm) : 0;
    let isAnomaly = false;
    let anomalyReason: string | null = null;

    if (jamKerja > 0 && input.work_load_type) {
      const standardRate = getDynamicRate(eq.equipment_categories, input.work_load_type);
      const rasioAktual = input.quantity_liter / jamKerja;
      
      // Toleransi 20% dari standar
      if (rasioAktual > (standardRate * 1.2)) {
        isAnomaly = true;
        anomalyReason = `Rasio ${rasioAktual.toFixed(2)} L/jam melebihi standar (${standardRate} L/jam). Indikasi Kebocoran/Kecurangan.`;
      }
    }

    // Simpan Transaksi
    const { error: trxError } = await supabase.from('fuel_transactions').insert({
      ...input,
      is_anomaly: isAnomaly,
      anomaly_reason: anomalyReason
    });
    if (trxError) throw trxError;

    // Update Stok Tangki Induk & HM Alat
    await supabase.from('fuel_tanks')
      .update({ current_stock_liter: tank.current_stock_liter - input.quantity_liter })
      .eq('id', tank.id);

    if (input.hm_recorded && input.hm_recorded > eq.current_hm) {
      await supabase.from('equipment_units')
        .update({ current_hm: input.hm_recorded })
        .eq('id', eq.id);
    }

    return { 
      success: true, 
      isAnomaly, 
      anomalyReason,
      message: isAnomaly ? 'BBM dicatat, namun ditandai ANOMALI untuk audit.' : 'Pengisian BBM berhasil.'
    };
  }
}

// ==========================================
// LOGIKA MINIMUM CHARGE & BREAKDOWN
// ==========================================
export function calculateBillableHours(
  totalWorkingHours: number,
  totalStandbyHours: number,
  totalBreakdownHours: number,
  minimumCharge: number,
  isVendorFault: boolean = true // Default: jika rusak, itu tanggung jawab vendor
) {
  const totalActualHours = totalWorkingHours + totalStandbyHours;
  
  // 1. Cek jika memenuhi minimum charge
  if (totalActualHours >= minimumCharge) {
    return {
      billable_hours: totalActualHours,
      is_minimum_charge_applied: false,
      status: 'Normal / Lembur (Overtime)'
    };
  }

  // 2. Jika di bawah minimum charge, cek apakah karena breakdown
  if (totalActualHours < minimumCharge) {
    if (totalBreakdownHours > 0 && isVendorFault) {
      // Jika rusak karena vendor, tagih sesuai jam aktual (atau minimum charge - jam rusak)
      const adjustedMinimum = Math.max(0, minimumCharge - totalBreakdownHours);
      const billable = Math.max(totalActualHours, adjustedMinimum);
      
      return {
        billable_hours: billable,
        is_minimum_charge_applied: false,
        status: `Minimum Charge Dikurangi Breakdown (${totalBreakdownHours} Jam)`
      };
    } else {
      // Jika tidak ada breakdown, paksa tagih sesuai Minimum Charge
      return {
        billable_hours: minimumCharge,
        is_minimum_charge_applied: true,
        status: 'Minimum Charge Diterapkan'
      };
    }
  }

  return { billable_hours: 0, is_minimum_charge_applied: false, status: 'Error' };
}

// Simpan Timesheet
export async function saveDailyTimesheet(payload: any) {
  const { data, error } = await supabase.from('equipment_timesheets').insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data;
}