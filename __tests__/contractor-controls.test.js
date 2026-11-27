import {
  evaluateRingFencedCashflow,
  evaluateGuaranteeAndRetentionAlert,
  computeBakpProgressBilling,
  evaluateUnapprovedVariationWork,
} from '@/lib/utils/contractor-controls';

describe('Wave D: Ring-Fenced Cashflow, Bank Guarantees, BAKP Billing & Unapproved Variation Work', () => {
  test('evaluateRingFencedCashflow memblokir pengeluaran yang membuat kas proyek defisit melebihi plafon Dropping HQ', () => {
    const blocked = evaluateRingFencedCashflow({
      clientInflow: 500_000_000,
      hqDropping: 0,
      actualOutflow: 420_000_000,
      pendingOutflow: 30_000_000,
      requestedOutflow: 100_000_000,
      ringFencedEnabled: true,
      hqDroppingLimit: 0,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.status).toBe('DEFICIT_BLOCKED');
    expect(blocked.deficitAmount).toBe(50_000_000);

    const withDroppingLimit = evaluateRingFencedCashflow({
      clientInflow: 500_000_000,
      actualOutflow: 450_000_000,
      requestedOutflow: 100_000_000,
      ringFencedEnabled: true,
      hqDroppingLimit: 100_000_000,
    });
    expect(withDroppingLimit.allowed).toBe(true);
    expect(withDroppingLimit.status).toBe('DEFICIT_WITH_DROPPING');
    expect(withDroppingLimit.requiresHqDropping).toBe(true);
  });

  test('evaluateGuaranteeAndRetentionAlert mengklasifikasikan EXPIRED, H-7, H-14, H-30, dan SAFE dengan akurat', () => {
    const ref = new Date('2026-11-27T00:00:00Z');

    expect(evaluateGuaranteeAndRetentionAlert('2026-11-20', ref).severity).toBe('EXPIRED');
    expect(evaluateGuaranteeAndRetentionAlert('2026-12-02', ref).severity).toBe('CRITICAL_7D');
    expect(evaluateGuaranteeAndRetentionAlert('2026-12-10', ref).severity).toBe('WARNING_14D');
    expect(evaluateGuaranteeAndRetentionAlert('2026-12-20', ref).severity).toBe('UPCOMING_30D');
    expect(evaluateGuaranteeAndRetentionAlert('2027-03-01', ref).severity).toBe('SAFE');
  });

  test('computeBakpProgressBilling menghitung bobot progres tertimbang WBS, delta termin, retensi 5%, dan PPN 11%', () => {
    const res = computeBakpProgressBilling({
      wbsTasks: [
        { cost: 1_000_000_000, progressPercent: 50, summary: 'Yes' }, // parent diabaikan
        { cost: 600_000_000, progressPercent: 50, summary: 'No' },
        { cost: 400_000_000, progressPercent: 25, summary: 'No' },
      ],
      contractValue: 1_000_000_000,
      previousProgressPct: 15,
      retentionPct: 5,
      ppnPct: 11,
    });

    // Weighted progress = (600M*50 + 400M*25) / 1000M = 40%
    expect(res.weightedActualProgressPct).toBe(40);
    // Delta = 40% - 15% = 25% -> Gross = 250M
    expect(res.deltaProgressPct).toBe(25);
    expect(res.grossAmount).toBe(250_000_000);
    // Retention 5% = 12.5M -> Net DPP = 237.5M -> PPN 11% = 26,125,000 -> Net Billable = 263,625,000
    expect(res.retentionAmount).toBe(12_500_000);
    expect(res.ppnAmount).toBe(26_125_000);
    expect(res.netBillableAmount).toBe(263_625_000);
  });

  test('evaluateUnapprovedVariationWork menandai biaya pekerjaan tambah tanpa CCO Signed/Approved', () => {
    const summary = evaluateUnapprovedVariationWork([
      {
        recordId: 'cf-1',
        sourceType: 'CASH_FLOW',
        wbsCode: '2.4',
        workLabel: 'Borepile Tambahan Zona C',
        incurredCost: 75_000_000,
        isVariationWork: true,
        ccoStatus: 'Draft',
      },
      {
        recordId: 'po-1',
        sourceType: 'PURCHASE_ORDER',
        wbsCode: '2.4',
        workLabel: 'PO Besi Tambahan',
        incurredCost: 45_000_000,
        isVariationWork: true,
        ccoStatus: null,
      },
      {
        recordId: 'cf-2',
        sourceType: 'CASH_FLOW',
        wbsCode: '3.1',
        workLabel: 'Pekerjaan Tambah Resmi',
        incurredCost: 90_000_000,
        isVariationWork: true,
        ccoStatus: 'Signed',
      },
    ]);

    expect(summary.hasAlert).toBe(true);
    expect(summary.unapprovedCount).toBe(2);
    expect(summary.totalExposedCost).toBe(120_000_000);
  });
});
