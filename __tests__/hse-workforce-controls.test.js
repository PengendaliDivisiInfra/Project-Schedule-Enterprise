import {
  evaluateHseComplianceGate,
  normalizeNik,
  detectGhostWorkerConflict,
  calculateCompressionStats,
} from '@/lib/utils/hse-workforce-controls';

describe('Wave F: HSE Compliance Gate, Offline Photo Compression & Anti-Ghost Workers', () => {
  test('evaluateHseComplianceGate memblokir progres pekerjaan risiko tinggi tanpa JSA / Work Permit aktif', () => {
    const blocked = evaluateHseComplianceGate({
      isHighRisk: true,
      wbsCode: '2.1',
      recordDate: '2026-11-27',
      permits: [
        {
          id: 'p-expired',
          wbs_code: '2.1',
          permit_type: 'JSA',
          permit_number: 'JSA-001',
          valid_from: '2026-11-01',
          valid_until: '2026-11-20',
          status: 'Active',
        },
      ],
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.requiresHseGate).toBe(true);
    expect(blocked.missingRequirements.length).toBeGreaterThan(0);

    const passed = evaluateHseComplianceGate({
      isHighRisk: true,
      wbsCode: '2.1',
      recordDate: '2026-11-27',
      permits: [
        {
          id: 'p-valid',
          wbs_code: '2.1',
          permit_type: 'WORK_PERMIT',
          permit_number: 'PTW-2026-011',
          valid_from: '2026-11-25',
          valid_until: '2026-12-05',
          status: 'Active',
        },
      ],
    });
    expect(passed.allowed).toBe(true);
    expect(passed.matchedPermitId).toBe('p-valid');
  });

  test('evaluateHseComplianceGate otomatis meluluskan pekerjaan standar (non high-risk)', () => {
    const res = evaluateHseComplianceGate({
      isHighRisk: false,
      wbsCode: '1.1',
      recordDate: '2026-11-27',
      permits: [],
    });
    expect(res.allowed).toBe(true);
    expect(res.requiresHseGate).toBe(false);
  });

  test('detectGhostWorkerConflict memblokir NIK identik yang hadir di dua proyek berbeda pada tanggal sama', () => {
    expect(normalizeNik('3578-0123-4567-0001')).toBe('3578012345670001');

    const conflict = detectGhostWorkerConflict({
      candidate: {
        employeeId: 'emp-b',
        employeeName: 'Ahmad Tukang',
        nik: '3578-0123-4567-0001',
        projectId: 'proj-talang',
        attendanceDate: '2026-11-27',
        status: 'Present',
      },
      existingAttendances: [
        {
          employeeId: 'emp-a',
          employeeName: 'Ahmad Tukang',
          nik: '3578012345670001',
          projectId: 'proj-saddang',
          projectName: 'D.I. Saddang',
          attendanceDate: '2026-11-27',
          status: 'Present',
        },
      ],
    });
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.conflictingProjectId).toBe('proj-saddang');
    expect(conflict.message).toMatch(/D\.I\. Saddang/);

    // Tidak konflik jika beda tanggal atau status Absent
    const noConflict = detectGhostWorkerConflict({
      candidate: {
        employeeId: 'emp-b',
        employeeName: 'Ahmad Tukang',
        nik: '3578012345670001',
        projectId: 'proj-talang',
        attendanceDate: '2026-11-28',
        status: 'Present',
      },
      existingAttendances: [
        {
          employeeId: 'emp-a',
          employeeName: 'Ahmad Tukang',
          nik: '3578012345670001',
          projectId: 'proj-saddang',
          projectName: 'D.I. Saddang',
          attendanceDate: '2026-11-27',
          status: 'Present',
        },
      ],
    });
    expect(noConflict.hasConflict).toBe(false);
  });

  test('calculateCompressionStats menghitung penghematan kuota kompresi foto lapangan dengan akurat', () => {
    const stats = calculateCompressionStats(4_000_000, 240_000);
    expect(stats.savedBytes).toBe(3_760_000);
    expect(stats.savedPercent).toBe(94);
    expect(stats.originalLabel).toBe('3.81 MB');
    expect(stats.compressedLabel).toBe('234.4 KB');
  });
});
