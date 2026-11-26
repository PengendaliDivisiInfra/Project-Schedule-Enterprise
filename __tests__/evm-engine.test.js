import { generateEVMData } from '@/lib/evmEngine';

describe('EVM Engine (lib/evmEngine.js)', () => {
  test('menghitung BAC, SPI, CPI, ETC, EAC, VAC, dan TCPI secara presisi', () => {
    const tasks = [
      {
        id: 't1',
        name: 'Pekerjaan Saluran Primer',
        summary: 'No',
        start_date: '2026-11-02', // Senin
        end_date: '2026-11-06',   // Jumat (5 hari kerja -> PV = 20jt/hari)
        cost: 100_000_000,
      },
    ];

    const dailyRecords = [
      {
        task_id: 't1',
        record_date: '2026-11-04', // Rabu (Hari ke-3 -> PV = 60jt)
        progress_percent: 45,      // EV = 45jt
        actual_cost: 50_000_000,   // AC = 50jt
      },
    ];

    const { chartData, summaryKPI } = generateEVMData(
      tasks,
      '2026-11-02',
      '2026-11-04',
      dailyRecords
    );

    expect(chartData.length).toBe(5);
    expect(summaryKPI.bac).toBe(100_000_000);
    expect(summaryKPI.spi).toBe(0.75);  // 45jt / 60jt
    expect(summaryKPI.cpi).toBe(0.9);   // 45jt / 50jt
    expect(summaryKPI.etc).toBe(61_111_111);
    expect(summaryKPI.eac).toBe(111_111_111);
    expect(summaryKPI.vac).toBe(-11_111_111);
    expect(summaryKPI.tcpi).toBe(1.1);  // (100jt - 45jt) / (100jt - 50jt)
  });

  test('mengembalikan KPI default aman saat daftar tugas kosong', () => {
    const { chartData, summaryKPI } = generateEVMData([], '2026-11-02', '2026-11-04', []);
    expect(chartData).toEqual([]);
    expect(summaryKPI).toEqual({
      bac: 0,
      spi: 1,
      cpi: 1,
      eac: 0,
      etc: 0,
      vac: 0,
      tcpi: 1,
    });
  });
});
