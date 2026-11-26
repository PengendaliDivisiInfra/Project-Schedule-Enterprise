/**
 * Kalkulator Upah Lembur Bertingkat sesuai PP No. 35 Tahun 2021 (Hari Kerja Normal).
 * - Upah sejam = 1/173 x (Gaji Pokok + Tunjangan Tetap)
 * - Jam lembur ke-1 = 1,5 x upah sejam
 * - Jam lembur ke-2 dst = 2,0 x upah sejam
 */

export const PP35_MONTHLY_HOUR_DIVISOR = 173;

export interface OvertimePP35Summary {
  totalHours: number;
  weightedPoints: number;
  hourlyRate: number;
  overtimePay: number;
}

/**
 * Menghitung poin pengali lembur harian berdasarkan PP 35/2021.
 * Contoh: 1 jam -> 1.5; 2 jam -> 3.5; 3 jam -> 5.5.
 */
export function calcDailyOvertimePointsPP35(dailyHours: number): number {
  const hours = Number(dailyHours);
  if (!Number.isFinite(hours) || hours <= 0) return 0;

  const firstHour = Math.min(1, hours);
  const subsequentHours = Math.max(0, hours - 1);
  return firstHour * 1.5 + subsequentHours * 2.0;
}

/**
 * Menghitung tarif upah lembur per jam (1/173 dari upah bulanan).
 */
export function calcHourlyRatePP35(baseSalary: number, fixedAllowance: number = 0): number {
  const monthlyWage = Math.max(0, Number(baseSalary) || 0) + Math.max(0, Number(fixedAllowance) || 0);
  return monthlyWage / PP35_MONTHLY_HOUR_DIVISOR;
}

/**
 * Menghitung ringkasan upah lembur bulanan dari daftar jam lembur harian.
 */
export function calcMonthlyOvertimePayPP35(
  baseSalary: number,
  fixedAllowance: number,
  dailyOvertimeHours: number[]
): OvertimePP35Summary {
  let totalHours = 0;
  let weightedPoints = 0;

  for (const rawHours of dailyOvertimeHours || []) {
    const h = Number(rawHours);
    if (Number.isFinite(h) && h > 0) {
      totalHours += h;
      weightedPoints += calcDailyOvertimePointsPP35(h);
    }
  }

  const hourlyRate = calcHourlyRatePP35(baseSalary, fixedAllowance);
  const overtimePay = Math.round(weightedPoints * hourlyRate);

  return {
    totalHours,
    weightedPoints,
    hourlyRate,
    overtimePay,
  };
}
