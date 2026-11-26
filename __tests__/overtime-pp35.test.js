import {
  calcDailyOvertimePointsPP35,
  calcHourlyRatePP35,
  calcMonthlyOvertimePayPP35,
} from '@/lib/utils/overtime-pp35';

describe('Kalkulator Lembur Bertingkat PP 35/2021', () => {
  test('menghitung poin pengali lembur harian secara bertingkat (Jam ke-1 = 1.5x, Jam ke-2+ = 2.0x)', () => {
    expect(calcDailyOvertimePointsPP35(0)).toBe(0);
    expect(calcDailyOvertimePointsPP35(-2)).toBe(0);
    expect(calcDailyOvertimePointsPP35(0.5)).toBeCloseTo(0.75, 5);
    expect(calcDailyOvertimePointsPP35(1)).toBeCloseTo(1.5, 5);
    expect(calcDailyOvertimePointsPP35(2)).toBeCloseTo(3.5, 5);
    expect(calcDailyOvertimePointsPP35(3)).toBeCloseTo(5.5, 5);
  });

  test('menghitung tarif sejam 1/173 dari (Gaji Pokok + Tunjangan Tetap)', () => {
    expect(calcHourlyRatePP35(5_190_000, 1_730_000)).toBeCloseTo(40_000, 5);
  });

  test('menghitung total upah lembur bulanan dari beberapa hari absensi', () => {
    const summary = calcMonthlyOvertimePayPP35(5_190_000, 1_730_000, [1, 2, 0, 3]);
    expect(summary.totalHours).toBe(6);
    expect(summary.weightedPoints).toBeCloseTo(10.5, 5);
    expect(summary.hourlyRate).toBeCloseTo(40_000, 5);
    expect(summary.overtimePay).toBe(420_000);
  });
});
