import { supabase } from '../supabase';
import type { Employee } from '@/types/payroll';
import { calcDailyOvertimePointsPP35, calcHourlyRatePP35 } from '@/lib/utils/overtime-pp35';

// ==========================================
// 1. SERVICE MASTER KARYAWAN
// ==========================================
export async function getEmployees(projectId: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true) 
    .order('name');
  if (error) throw new Error(error.message);
  return data as Employee[];
}

export async function createEmployee(payload: Partial<Employee>) {
  const { data, error } = await supabase.from('employees').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEmployee(id: string, payload: Partial<Employee>) {
  const { data, error } = await supabase.from('employees').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteEmployee(id: string) {
  const { error } = await supabase.from('employees').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ==========================================
// 2. SERVICE ABSENSI BULANAN (MATRIKS)
// ==========================================
export async function getMonthlyAttendance(projectId: string, monthString: string) {
  const startDate = `${monthString}-01`;
  const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true);
  
  if (empError) throw new Error(empError.message);

  const { data: attendances, error: attError } = await supabase
    .from('employee_attendances')
    .select('*')
    .in('employee_id', employees.map(e => e.id))
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate);

  if (attError) throw new Error(attError.message);

  const result = employees.map(emp => {
    const empAtt = attendances?.filter(a => a.employee_id === emp.id) || [];
    const attendanceMap: Record<string, any> = {};
    
    let totalHadir = 0;
    let totalSakitIzinCuti = 0;
    let totalAlpa = 0;
    let totalLembur = 0;

    empAtt.forEach(att => {
      attendanceMap[att.attendance_date] = att;
      if (att.status === 'Present') totalHadir++;
      else if (['Sick', 'Leave', 'Cut'].includes(att.status)) totalSakitIzinCuti++;
      else if (att.status === 'Absent') totalAlpa++;
      totalLembur += Number(att.overtime_hours) || 0;
    });

    return {
      ...emp,
      attendanceMap,
      summary: { totalHadir, totalSakitIzinCuti, totalAlpa, totalLembur }
    };
  });

  return { result, startDate, endDate };
}

// ==========================================
// 3. SERVICE ABSENSI HARIAN
// ==========================================
export async function getAttendanceByDate(projectId: string, date: string) {
  const { data: allEmployees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true); 
  
  if (empError) throw new Error(empError.message);

  const validEmployees = (allEmployees || []).filter(emp => {
    if (emp.employment_status === 'Active' || !emp.employment_status) return true;
    
    if (emp.resignation_date) {
      const attDate = new Date(date);
      const resignDate = new Date(emp.resignation_date);
      attDate.setHours(0,0,0,0);
      resignDate.setHours(0,0,0,0);
      return attDate <= resignDate;
    }
    
    return false;
  });

  const empIds = validEmployees.map(e => e.id);
  if (empIds.length === 0) return [];

  const { data: attendances } = await supabase
    .from('employee_attendances')
    .select('*')
    .eq('attendance_date', date)
    .in('employee_id', empIds);

  return validEmployees.map(emp => {
    const att = attendances?.find(a => a.employee_id === emp.id);
    return {
      ...emp,
      attendance_id: att?.id || null,
      status: att ? att.status : 'Unmarked',
      clock_in: att?.clock_in || '',
      clock_out: att?.clock_out || '',
      overtime_hours: att?.overtime_hours || 0,
      notes: att?.notes || ''
    };
  });
}

export async function saveAttendance(payload: { 
  employee_id: string, 
  attendance_date: string, 
  status: string, 
  clock_in?: string, 
  clock_out?: string, 
  overtime_hours: number, 
  notes: string 
}) {
  const { error } = await supabase
    .from('employee_attendances')
    .upsert({
      employee_id: payload.employee_id,
      attendance_date: payload.attendance_date,
      status: payload.status,
      clock_in: payload.clock_in || null,
      clock_out: payload.clock_out || null,
      overtime_hours: payload.overtime_hours,
      notes: payload.notes
    }, { onConflict: 'employee_id, attendance_date' });
    
  if (error) throw new Error(error.message);
}

// ==========================================
// 4. SERVICE PAYROLL (PROSES GAJI)
// ==========================================
export async function generatePayroll(projectId: string, startDate: string, endDate: string, payrollType: 'Monthly' | 'Weekly') {
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('project_id', projectId)
    .eq('employee_type', payrollType === 'Monthly' ? 'Office' : 'Project')
    .eq('is_active', true);

  if (!employees || employees.length === 0) throw new Error("Tidak ada karyawan aktif untuk tipe ini.");

  const { data: attendances } = await supabase
    .from('employee_attendances')
    .select('*')
    .in('employee_id', employees.map(e => e.id))
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate);

  const items = employees.map(emp => {
    const empAtt = attendances?.filter(a => a.employee_id === emp.id) || [];
    let daysPresent = 0;
    let daysAbsent = 0;
    let daysForMeal = 0; // Khusus Uang Makan (Hanya jika benar-benar hadir)
    let totalOvertime = 0;
    let totalOvertimeWeightedPP35 = 0; // Poin lembur bertingkat PP 35/2021 (Jam ke-1 = 1.5x, Jam ke-2 dst = 2.0x)

    empAtt.forEach(a => {
      if (a.status === 'Present') {
        daysPresent++;
        daysForMeal++;
      } else if (a.status === 'Sick' || a.status === 'Leave') {
        daysPresent++; // Sakit/Izin tetap dihitung untuk Gaji Pokok, tapi Uang Makan dipotong
      } else if (a.status === 'Absent') {
        daysAbsent++;
      }
      const dailyOt = Math.max(0, Number(a.overtime_hours) || 0);
      totalOvertime += dailyOt;
      totalOvertimeWeightedPP35 += calcDailyOvertimePointsPP35(dailyOt);
    });

    if (daysPresent === 0 && daysAbsent === 0) return null;

    // ==========================================
    // LOGIKA PERHITUNGAN GAJI (PP 35/2021 & ALL-IN)
    // ==========================================
    const baseSalary = Number(emp.base_salary) || 0;
    const tunjangan = Number(emp.tunjangan) || 0;
    const dailyRate = Number(emp.daily_rate) || 0;
    const mealAllowance = Number(emp.meal_allowance) || 0;
    const manualOvertimeRate = Number(emp.overtime_rate) || 0;

    let basePay = 0;
    let overtimePay = 0;
    let mealPay = 0;

    // Uang Makan SELALU dihitung berdasarkan hari kehadiran fisik (daysForMeal)
    mealPay = daysForMeal * mealAllowance;

    if (emp.is_all_in) {
      // --- SISTEM ALL-IN (LUMP SUM) ---
      if (emp.employee_type === 'Office') {
        // Bulanan All-In: Gaji & Tunjangan tetap utuh, dipotong HANYA jika mangkir
        const dailyAllIn = (baseSalary + tunjangan) / 21; 
        const deductionAbsent = daysAbsent * dailyAllIn;
        
        basePay = (baseSalary + tunjangan) - deductionAbsent; 
        overtimePay = 0; // Lembur menyatu dengan paket All-In
      } else {
        // Harian All-In: Upah Harian + Tunjangan (jika ada)
        basePay = (daysPresent * dailyRate) + tunjangan; 
        overtimePay = 0; // Lembur menyatu
      }
    } else {
      // --- SISTEM REGULER (STANDAR) ---
      if (emp.employee_type === 'Office') {
        const WORKING_DAYS = 21; 
        const prorata = daysPresent >= WORKING_DAYS ? 1 : (daysPresent / WORKING_DAYS);
        
        basePay = (baseSalary + tunjangan) * prorata;
        
        // PP 35/2021: Upah lembur per jam = 1/173 x upah sebulan; Jam ke-1 = 1.5x, Jam ke-2+ = 2.0x
        const hourlyRate = calcHourlyRatePP35(baseSalary, tunjangan);
        overtimePay = Math.round(totalOvertimeWeightedPP35 * hourlyRate);
      } else {
        basePay = (daysPresent * dailyRate) + tunjangan;
        overtimePay = totalOvertime * manualOvertimeRate; // Lembur dipisah
      }
    }

    const totalPay = basePay + overtimePay + mealPay;

    return { 
      employee_id: emp.id, 
      name: emp.name, 
      days_present: daysPresent, 
      total_overtime_hours: totalOvertime, 
      base_pay: basePay, 
      overtime_pay: overtimePay, 
      meal_pay: mealPay, 
      total_pay: totalPay 
    };
  }).filter(Boolean);

  const totalAmount = items.reduce((sum, i) => sum + (i?.total_pay || 0), 0);
  return { items, totalAmount };
}

export async function savePayroll(projectId: string, periodStart: string, periodEnd: string, payrollType: string, items: any[], totalAmount: number) {
  const { data: payroll, error: pError } = await supabase.from('payrolls').insert({
    project_id: projectId, period_start: periodStart, period_end: periodEnd, payroll_type: payrollType, status: 'Draft', total_amount: totalAmount
  }).select().single();

  if (pError) throw new Error(pError.message);

  const payrollItems = items.map(item => ({
    payroll_id: payroll.id, employee_id: item.employee_id, days_present: item.days_present, total_overtime_hours: item.total_overtime_hours, base_pay: item.base_pay, overtime_pay: item.overtime_pay, meal_pay: item.meal_pay, total_pay: item.total_pay
  }));

  const { error: iError } = await supabase.from('payroll_items').insert(payrollItems);
  if (iError) throw new Error(iError.message);

  return payroll;
}

export async function approvePayroll(payrollId: string, projectId: string, totalAmount: number, periodEnd: string) {
  const { data: current } = await supabase.from('payrolls').select('status').eq('id', payrollId).single();
  if (current?.status === 'Approved' || current?.status === 'Paid') {
    throw new Error("Payroll ini sudah disetujui atau dibayar.");
  }

  const { error: pError } = await supabase.from('payrolls').update({ status: 'Approved', approved_at: new Date().toISOString() }).eq('id', payrollId);
  if (pError) throw new Error(pError.message);

  const { error: costError } = await supabase.from('actual_costs').insert({
    project_id: projectId, resource_type: 'Labor', cost_amount: totalAmount, source_id: payrollId, reference_type: 'payroll', recorded_at: new Date().toISOString()
  });
  if (costError) throw new Error("Gagal menyuntik ke Actual Cost: " + costError.message);
}

export async function payPayroll(payrollId: string, projectId: string, totalAmount: number, periodEnd: string) {
  const { data: current } = await supabase.from('payrolls').select('status').eq('id', payrollId).single();
  if (current?.status === 'Paid') {
    throw new Error("Payroll ini sudah dibayar.");
  }

  const { error: pError } = await supabase.from('payrolls').update({ status: 'Paid', paid_at: new Date().toISOString() }).eq('id', payrollId);
  if (pError) throw new Error(pError.message);

  const { error: cashError } = await supabase.from('cash_flows').insert({
    project_id: projectId, transaction_date: new Date().toISOString().split('T')[0], type: 'OUT', category: 'Upah', amount: totalAmount, description: `Pembayaran Gaji Karyawan (Periode s/d ${periodEnd})`, reference_id: payrollId, vendor_or_ref: 'Payroll', approval_status: 'Approved'
  });
  if (cashError) throw new Error("Gagal menyuntik ke Cash Flow: " + cashError.message);
}

// ==========================================
// 5. SERVICE RIWAYAT & DETAIL PAYROLL
// ==========================================
export async function getPayrollHistory(projectId: string) {
  const { data, error } = await supabase
    .from('payrolls')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getPayrollDetails(payrollId: string) {
  const { data, error } = await supabase
    .from('payroll_items')
    .select(`
      *,
      employees (name, role_title)
    `)
    .eq('payroll_id', payrollId);
    
  if (error) throw new Error(error.message);
  return data;
}

export async function voidPayroll(payrollId: string, projectId: string, totalAmount: number, currentStatus: string, description: string) {
  if (currentStatus === 'Voided') throw new Error("Payroll ini sudah dibatalkan sebelumnya.");
  
  const now = new Date().toISOString();

  const { error: pError } = await supabase.from('payrolls').update({ 
    status: 'Voided',
    voided_at: now,
    void_reason: description
  }).eq('id', payrollId);
  if (pError) throw new Error(pError.message);

  if (currentStatus === 'Approved' || currentStatus === 'Paid') {
    const { error: costError } = await supabase
      .from('actual_costs')
      .update({ 
        is_deleted: true,
        is_void: true,
        voided_at: now, 
        void_reason: `Payroll dibatalkan: ${description}` 
      })
      .eq('source_id', payrollId)
      .eq('reference_type', 'payroll');
      
    if (costError) throw new Error("Gagal membatalkan Actual Cost: " + costError.message);
  }

  if (currentStatus === 'Paid') {
    const { error: cashError } = await supabase
      .from('cash_flows')
      .update({ 
        is_deleted: true,
        is_void: true,
        voided_at: now, 
        void_reason: `Payroll dibatalkan: ${description}` 
      })
      .eq('reference_id', payrollId)
      .eq('vendor_or_ref', 'Payroll')
      .eq('category', 'Upah')
      .eq('type', 'OUT');
      
    if (cashError) throw new Error("Gagal membatalkan Arus Kas: " + cashError.message);
  }
}