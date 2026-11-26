import {
  isWorkingDay,
  addWorkingDays,
  getWorkingDaysDiff,
  parsePredecessors,
  validateCircularDependency,
  calculateCPM,
} from '@/lib/cpmEngine';

describe('CPM Scheduling Engine (lib/cpmEngine.js)', () => {
  test('isWorkingDay, addWorkingDays, dan getWorkingDaysDiff menghormati akhir pekan & hari libur', () => {
    const workDays = [1, 2, 3, 4, 5]; // Senin - Jumat
    const holidays = new Set(['2026-11-03']); // Selasa libur

    expect(isWorkingDay(new Date('2026-11-02'), workDays, holidays)).toBe(true);
    expect(isWorkingDay(new Date('2026-11-03'), workDays, holidays)).toBe(false);
    expect(isWorkingDay(new Date('2026-11-07'), workDays, holidays)).toBe(false); // Sabtu

    // Mulai Senin 2 Nov, 3 hari kerja (skip Selasa 3 Nov) -> Kamis 5 Nov
    expect(addWorkingDays('2026-11-02', 3, workDays, holidays)).toBe('2026-11-05');
    // Senin 2 Nov s/d Minggu 8 Nov tanpa libur = 5 hari kerja
    expect(getWorkingDaysDiff('2026-11-02', '2026-11-08', workDays, new Set())).toBe(5);
  });

  test('parsePredecessors mem-parsing relasi FS/SS/FF/SF beserta lag positif & negatif', () => {
    const parsed = parsePredecessors('1.1FS+2d, 1.2 SS-1, 2.1');
    expect(parsed).toEqual([
      { wbs: '1.1', type: 'FS', lag: 2 },
      { wbs: '1.2', type: 'SS', lag: -1 },
      { wbs: '2.1', type: 'FS', lag: 0 },
    ]);
  });

  test('validateCircularDependency mendeteksi siklus ketergantungan tugas', () => {
    const cyclic = [
      { id: '1', wbs_code: '1.1', predecessors: '1.2' },
      { id: '2', wbs_code: '1.2', predecessors: '1.1' },
    ];
    const checkCycle = validateCircularDependency(cyclic);
    expect(checkCycle.isValid).toBe(false);
    expect(checkCycle.message).toMatch(/Circular Dependency/i);

    const acyclic = [
      { id: '1', wbs_code: '1.1', predecessors: '' },
      { id: '2', wbs_code: '1.2', predecessors: '1.1FS' },
    ];
    expect(validateCircularDependency(acyclic).isValid).toBe(true);
  });

  test('calculateCPM menghitung jalur kritis, total float, dan rollup biaya WBS', () => {
    const rawTasks = [
      { id: 'p1', wbs_code: '1', name: 'Pekerjaan Struktur', summary: 'Yes', duration: 0, cost: 0 },
      { id: 't1', wbs_code: '1.1', name: 'Galian Pondasi', summary: 'No', duration: 5, cost: 100_000_000, predecessors: '' },
      { id: 't2', wbs_code: '1.2', name: 'Cor Beton', summary: 'No', duration: 5, cost: 250_000_000, predecessors: '1.1FS+1d' },
      { id: 't3', wbs_code: '1.3', name: 'Pekerjaan Pendukung', summary: 'No', duration: 2, cost: 50_000_000, predecessors: '' },
    ];

    const result = calculateCPM(rawTasks, '2026-11-02', [1, 2, 3, 4, 5], []);
    expect(result.error).toBeNull();

    const byCode = Object.fromEntries(result.tasks.map((t) => [t.wbs_code, t]));
    expect(byCode['1'].cost).toBe(400_000_000);
    expect(byCode['1.1'].is_critical).toBe(true);
    expect(byCode['1.2'].is_critical).toBe(true);
    expect(byCode['1.3'].is_critical).toBe(false);
    expect(byCode['1.3'].total_float).toBeGreaterThan(0);
    expect(result.relations.length).toBe(1);
    expect(result.relations[0].is_critical).toBe(true);
  });
});
