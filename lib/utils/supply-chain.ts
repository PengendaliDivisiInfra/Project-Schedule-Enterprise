// lib/utils/supply-chain.ts

export interface ThreeWayMatchItemInput {
  itemName: string;
  orderedQty: number;
  receivedQty: number;
  invoicedQty: number;
  poUnitPrice: number;
  invoiceUnitPrice: number;
}

export interface GrnEvidenceRecord {
  doNumber?: string | null;
  suratJalanUrl?: string | null;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  capturedAt?: string | null;
}

export interface ThreeWayMatchResult {
  canApprovePayment: boolean;
  status: 'MATCHED' | 'MISMATCH' | 'PENDING_EVIDENCE';
  checks: {
    qtyMatchOk: boolean;
    priceMatchOk: boolean;
    evidenceMatchOk: boolean;
  };
  maxPriceVariancePct: number;
  reasons: string[];
}

export interface TransferCostAllocation {
  quantity: number;
  unitCost: number;
  totalValue: number;
  sourceProjectCostDelta: number;
  targetProjectCostDelta: number;
  transferMode: 'CENTRAL_TO_SITE' | 'SITE_TO_SITE';
}

export interface StockOpnameLineInput {
  itemName: string;
  systemQty: number;
  physicalQty: number;
  unitCost: number;
}

export interface StockOpnameSummary {
  lines: Array<StockOpnameLineInput & { varianceQty: number; varianceValue: number }>;
  totalVarianceQty: number;
  totalVarianceValue: number;
  shrinkageItems: number;
  surplusItems: number;
  matchedItems: number;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Validasi Otomatis Three-Way Matching (PO + GRN + Vendor Invoice + Bukti GPS/Surat Jalan):
 * Tombol "Approve Payment" hanya boleh aktif jika ketiga syarat lulus 100%.
 */
export function evaluateThreeWayMatch(params: {
  items: ThreeWayMatchItemInput[];
  evidences: GrnEvidenceRecord[];
  priceTolerancePct?: number;
  roundingToleranceRp?: number;
}): ThreeWayMatchResult {
  const tolerancePct = toNum(params.priceTolerancePct ?? 1.0);
  const roundingRp = toNum(params.roundingToleranceRp ?? 100);
  const reasons: string[] = [];

  const items = params.items || [];
  if (items.length === 0) {
    return {
      canApprovePayment: false,
      status: 'MISMATCH',
      checks: { qtyMatchOk: false, priceMatchOk: false, evidenceMatchOk: false },
      maxPriceVariancePct: 0,
      reasons: ['Tidak ada item PO/Invoice untuk divalidasi.'],
    };
  }

  let qtyMatchOk = true;
  let priceMatchOk = true;
  let maxPriceVariancePct = 0;

  for (const it of items) {
    const ordered = toNum(it.orderedQty);
    const received = toNum(it.receivedQty);
    const invoiced = toNum(it.invoicedQty);
    const poPrice = toNum(it.poUnitPrice);
    const invPrice = toNum(it.invoiceUnitPrice);

    if (received <= 0) {
      qtyMatchOk = false;
      reasons.push(`${it.itemName}: Barang belum diterima di gudang (GRN = 0).`);
    } else if (invoiced > received) {
      qtyMatchOk = false;
      reasons.push(
        `${it.itemName}: Qty tagihan (${invoiced}) melebihi Qty diterima di GRN (${received}).`
      );
    } else if (invoiced > ordered) {
      qtyMatchOk = false;
      reasons.push(
        `${it.itemName}: Qty tagihan (${invoiced}) melebihi Qty kontrak PO (${ordered}).`
      );
    }

    const diffRp = Math.abs(invPrice - poPrice);
    const variancePct = poPrice > 0 ? (diffRp / poPrice) * 100 : diffRp > 0 ? 100 : 0;
    if (variancePct > maxPriceVariancePct) {
      maxPriceVariancePct = Math.round(variancePct * 100) / 100;
    }

    if (diffRp > roundingRp && variancePct > tolerancePct) {
      priceMatchOk = false;
      reasons.push(
        `${it.itemName}: Harga Invoice Rp ${invPrice.toLocaleString('id-ID')} berbeda ${variancePct.toFixed(2)}% dari PO Rp ${poPrice.toLocaleString('id-ID')} (batas toleransi ${tolerancePct}%).`
      );
    }
  }

  // Syarat 3: Bukti Fisik Digital (Foto Surat Jalan + Timestamp + Koordinat GPS valid)
  const validEvidences = (params.evidences || []).filter((ev) => {
    const hasFile = Boolean(ev.suratJalanUrl && String(ev.suratJalanUrl).trim().length > 0);
    const hasTimestamp = Boolean(ev.capturedAt && !Number.isNaN(Date.parse(ev.capturedAt)));
    const lat = ev.gpsLatitude;
    const lng = ev.gpsLongitude;
    const hasGps =
      lat !== null &&
      lat !== undefined &&
      lng !== null &&
      lng !== undefined &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng)) &&
      Math.abs(Number(lat)) <= 90 &&
      Math.abs(Number(lng)) <= 180 &&
      !(Number(lat) === 0 && Number(lng) === 0);
    return hasFile && hasTimestamp && hasGps;
  });

  const evidenceMatchOk = validEvidences.length > 0;
  if (!evidenceMatchOk) {
    reasons.push(
      'Bukti Fisik Digital belum lengkap: wajib unggah foto Surat Jalan bertanda waktu (timestamp) & koordinat GPS pada Goods Receipt (GRN).'
    );
  }

  const canApprovePayment = qtyMatchOk && priceMatchOk && evidenceMatchOk;
  let status: 'MATCHED' | 'MISMATCH' | 'PENDING_EVIDENCE' = 'MATCHED';
  if (!qtyMatchOk || !priceMatchOk) {
    status = 'MISMATCH';
  } else if (!evidenceMatchOk) {
    status = 'PENDING_EVIDENCE';
  }

  return {
    canApprovePayment,
    status,
    checks: { qtyMatchOk, priceMatchOk, evidenceMatchOk },
    maxPriceVariancePct,
    reasons,
  };
}

/**
 * Menghitung realokasi nilai persediaan & beban biaya untuk Material Transfer Request.
 * - SITE_TO_SITE: biaya proyek asal berkurang (-totalValue), proyek tujuan bertambah (+totalValue).
 * - CENTRAL_TO_SITE: stok Gudang Pusat berkurang, proyek tujuan dibebani (+totalValue).
 */
export function calculateTransferCostAllocation(params: {
  quantity: number;
  unitCost: number;
  sourceProjectId?: string | null;
}): TransferCostAllocation {
  const qty = Math.max(0, toNum(params.quantity));
  const unitCost = Math.max(0, toNum(params.unitCost));
  const totalValue = Math.round(qty * unitCost * 100) / 100;
  const isSiteToSite = Boolean(params.sourceProjectId);

  return {
    quantity: qty,
    unitCost,
    totalValue,
    sourceProjectCostDelta: isSiteToSite ? -totalValue : 0,
    targetProjectCostDelta: totalValue,
    transferMode: isSiteToSite ? 'SITE_TO_SITE' : 'CENTRAL_TO_SITE',
  };
}

/**
 * Menghitung selisih Stock Opname (Fisik vs Sistem) beserta dampak nilai Rupiah.
 */
export function calculateStockOpnameVariance(lines: StockOpnameLineInput[]): StockOpnameSummary {
  let totalVarianceQty = 0;
  let totalVarianceValue = 0;
  let shrinkageItems = 0;
  let surplusItems = 0;
  let matchedItems = 0;

  const computed = (lines || []).map((line) => {
    const sys = toNum(line.systemQty);
    const phys = toNum(line.physicalQty);
    const cost = Math.max(0, toNum(line.unitCost));
    const varianceQty = Math.round((phys - sys) * 10000) / 10000;
    const varianceValue = Math.round(varianceQty * cost * 100) / 100;

    totalVarianceQty += varianceQty;
    totalVarianceValue += varianceValue;
    if (varianceQty < 0) shrinkageItems += 1;
    else if (varianceQty > 0) surplusItems += 1;
    else matchedItems += 1;

    return {
      ...line,
      systemQty: sys,
      physicalQty: phys,
      unitCost: cost,
      varianceQty,
      varianceValue,
    };
  });

  return {
    lines: computed,
    totalVarianceQty: Math.round(totalVarianceQty * 10000) / 10000,
    totalVarianceValue: Math.round(totalVarianceValue * 100) / 100,
    shrinkageItems,
    surplusItems,
    matchedItems,
  };
}
