import {
  evaluateThreeWayMatch,
  calculateTransferCostAllocation,
  calculateStockOpnameVariance,
} from '@/lib/utils/supply-chain';

describe('Wave C: Three-Way Matching, Multi-Warehouse Transfer & Stock Opname', () => {
  const validEvidence = [
    {
      doNumber: 'SJ-2026-001',
      suratJalanUrl: 'proj-1/sj_12345.jpg',
      gpsLatitude: -3.785211,
      gpsLongitude: 119.654321,
      capturedAt: '2026-11-27T08:30:00.000Z',
    },
  ];

  test('evaluateThreeWayMatch meluluskan pembayaran hanya jika Qty GRN, Harga PO, dan Bukti SJ+GPS terpenuhi', () => {
    const res = evaluateThreeWayMatch({
      items: [
        {
          itemName: 'Besi Ulir D13',
          orderedQty: 100,
          receivedQty: 100,
          invoicedQty: 100,
          poUnitPrice: 125_000,
          invoiceUnitPrice: 125_000,
        },
      ],
      evidences: validEvidence,
      priceTolerancePct: 1.0,
    });

    expect(res.canApprovePayment).toBe(true);
    expect(res.status).toBe('MATCHED');
    expect(res.checks).toEqual({
      qtyMatchOk: true,
      priceMatchOk: true,
      evidenceMatchOk: true,
    });
    expect(res.reasons).toHaveLength(0);
  });

  test('evaluateThreeWayMatch memblokir pembayaran jika Qty tagihan melebihi GRN atau harga melampaui toleransi', () => {
    const res = evaluateThreeWayMatch({
      items: [
        {
          itemName: 'Semen Portland 50kg',
          orderedQty: 200,
          receivedQty: 150,
          invoicedQty: 180,
          poUnitPrice: 70_000,
          invoiceUnitPrice: 75_000,
        },
      ],
      evidences: validEvidence,
      priceTolerancePct: 1.0,
    });

    expect(res.canApprovePayment).toBe(false);
    expect(res.status).toBe('MISMATCH');
    expect(res.checks.qtyMatchOk).toBe(false);
    expect(res.checks.priceMatchOk).toBe(false);
    expect(res.maxPriceVariancePct).toBeGreaterThan(7);
  });

  test('evaluateThreeWayMatch menandai PENDING_EVIDENCE jika foto Surat Jalan atau koordinat GPS belum diunggah', () => {
    const res = evaluateThreeWayMatch({
      items: [
        {
          itemName: 'Pasir Cor',
          orderedQty: 50,
          receivedQty: 50,
          invoicedQty: 50,
          poUnitPrice: 300_000,
          invoiceUnitPrice: 300_000,
        },
      ],
      evidences: [{ doNumber: 'SJ-002', suratJalanUrl: null, gpsLatitude: null, gpsLongitude: null }],
    });

    expect(res.canApprovePayment).toBe(false);
    expect(res.status).toBe('PENDING_EVIDENCE');
    expect(res.checks.evidenceMatchOk).toBe(false);
  });

  test('calculateTransferCostAllocation memindahkan beban biaya antar-proyek (Site-to-Site) vs Gudang Pusat', () => {
    const siteToSite = calculateTransferCostAllocation({
      quantity: 20,
      unitCost: 150_000,
      sourceProjectId: 'proj-saddang',
    });
    expect(siteToSite.transferMode).toBe('SITE_TO_SITE');
    expect(siteToSite.sourceProjectCostDelta).toBe(-3_000_000);
    expect(siteToSite.targetProjectCostDelta).toBe(3_000_000);

    const centralToSite = calculateTransferCostAllocation({
      quantity: 10,
      unitCost: 200_000,
      sourceProjectId: null,
    });
    expect(centralToSite.transferMode).toBe('CENTRAL_TO_SITE');
    expect(centralToSite.sourceProjectCostDelta).toBe(0);
    expect(centralToSite.targetProjectCostDelta).toBe(2_000_000);
  });

  test('calculateStockOpnameVariance menghitung selisih fisik vs sistem dan nilai penyusutan/surplus', () => {
    const summary = calculateStockOpnameVariance([
      { itemName: 'Semen', systemQty: 100, physicalQty: 95, unitCost: 70_000 },
      { itemName: 'Besi D10', systemQty: 50, physicalQty: 52, unitCost: 80_000 },
      { itemName: 'Kawat Bendrat', systemQty: 30, physicalQty: 30, unitCost: 25_000 },
    ]);

    expect(summary.shrinkageItems).toBe(1);
    expect(summary.surplusItems).toBe(1);
    expect(summary.matchedItems).toBe(1);
    expect(summary.totalVarianceQty).toBe(-3);
    expect(summary.totalVarianceValue).toBe(-190_000);
  });
});
