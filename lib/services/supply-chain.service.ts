// lib/services/supply-chain.service.ts
import { supabase } from '@/lib/supabase';
import { recordAuditEvent } from '@/lib/services/logs.service';
import {
  evaluateThreeWayMatch,
  type ThreeWayMatchResult,
  type GrnEvidenceRecord,
} from '@/lib/utils/supply-chain';
import { createPurchaseOrder } from '@/lib/services/purchase-order-service';

// ==========================================
// 1. PURCHASE REQUEST (PR) TERIKAT WBS/RAB
// ==========================================
export async function listPurchaseRequests(projectId: string) {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*, items:purchase_request_items(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function createPurchaseRequest(
  header: {
    project_id: string;
    pr_number: string;
    wbs_code: string | null;
    needed_date: string | null;
    justification: string;
    estimated_total: number;
  },
  items: Array<{
    hsd_id?: string | null;
    item_name: string;
    unit: string;
    requested_qty: number;
    estimated_unit_price: number;
    estimated_total: number;
  }>
) {
  const { data: sessionData } = await supabase.auth.getUser();
  const { data: pr, error } = await supabase
    .from('purchase_requests')
    .insert({
      ...header,
      requested_by: sessionData?.user?.id || null,
      status: 'Pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const itemsPayload = items.map((it) => ({
    pr_id: pr.id,
    hsd_id: it.hsd_id || null,
    item_name: it.item_name,
    unit: it.unit,
    requested_qty: Number(it.requested_qty),
    estimated_unit_price: Number(it.estimated_unit_price),
    estimated_total: Number(it.estimated_total),
  }));

  const { error: itemErr } = await supabase
    .from('purchase_request_items')
    .insert(itemsPayload);
  if (itemErr) throw new Error(itemErr.message);

  await recordAuditEvent({
    projectId: header.project_id,
    tableName: 'purchase_requests',
    action: 'INSERT',
    recordId: pr.id,
    newData: { pr_number: header.pr_number, wbs_code: header.wbs_code, estimated_total: header.estimated_total },
  });

  return pr;
}

export async function updatePurchaseRequestStatus(
  prId: string,
  projectId: string,
  status: 'Approved' | 'Rejected'
) {
  const { error } = await supabase
    .from('purchase_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', prId)
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'purchase_requests',
    action: status === 'Approved' ? 'APPROVE' : 'REJECT',
    recordId: prId,
    newData: { status },
  });
}

export async function convertPrToPo(params: {
  pr: any;
  vendorId: string;
  poNumber: string;
  shippingAddress?: string;
  ppnPercent?: number;
  pphPercent?: number;
}) {
  const prItems = params.pr?.items || [];
  if (prItems.length === 0) throw new Error('PR tidak memiliki item untuk dikonversi ke PO.');

  const subtotal = prItems.reduce((s: number, i: any) => s + Number(i.estimated_total || 0), 0);
  const ppnPct = params.ppnPercent ?? 11;
  const pphPct = params.pphPercent ?? 1.5;
  const ppnAmount = (subtotal * ppnPct) / 100;
  const pphAmount = (subtotal * pphPct) / 100;
  const grandTotal = subtotal + ppnAmount - pphAmount;

  const po = await createPurchaseOrder(
    {
      project_id: params.pr.project_id,
      vendor_id: params.vendorId,
      po_number: params.poNumber,
      po_date: new Date().toISOString().split('T')[0],
      status: 'Ordered',
      subtotal,
      ppn_percent: ppnPct,
      ppn_amount: ppnAmount,
      pph_percent: pphPct,
      pph_amount: pphAmount,
      grand_total: grandTotal,
      shipping_address: params.shippingAddress || 'Site Proyek',
      wbs_code: params.pr.wbs_code || null,
      pr_id: params.pr.id,
    } as any,
    prItems.map((it: any) => ({
      hsd_id: it.hsd_id || '',
      is_manual: !it.hsd_id,
      manual_name: it.item_name,
      manual_unit: it.unit,
      ordered_qty: Number(it.requested_qty),
      received_qty: 0,
      unit_price: Number(it.estimated_unit_price),
      total_price: Number(it.estimated_total),
    }))
  );

  await supabase
    .from('purchase_requests')
    .update({ status: 'Converted_to_PO', updated_at: new Date().toISOString() })
    .eq('id', params.pr.id);

  return po;
}

// ==========================================
// 2. VENDOR INVOICE & THREE-WAY MATCHING
// ==========================================
export async function listVendorInvoices(projectId: string) {
  const { data, error } = await supabase
    .from('vendor_invoices')
    .select(`
      *,
      purchase_order:purchase_orders(id, po_number, grand_total, paid_amount, payment_status, status),
      vendor:vendors(name),
      items:vendor_invoice_items(*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function getPoGrnEvidences(poId: string): Promise<GrnEvidenceRecord[]> {
  const { data: poItems } = await supabase
    .from('purchase_order_items')
    .select('id')
    .eq('po_id', poId);

  const itemIds = (poItems || []).map((i: any) => i.id);
  if (itemIds.length === 0) return [];

  const { data: grns, error } = await supabase
    .from('goods_receipts')
    .select('do_number, surat_jalan_url, gps_latitude, gps_longitude, captured_at')
    .in('po_item_id', itemIds);

  if (error) {
    // Fallback jika kolom GPS belum dimigrasi
    return [];
  }

  return (grns || []).map((g: any) => ({
    doNumber: g.do_number,
    suratJalanUrl: g.surat_jalan_url,
    gpsLatitude: g.gps_latitude !== null && g.gps_latitude !== undefined ? Number(g.gps_latitude) : null,
    gpsLongitude: g.gps_longitude !== null && g.gps_longitude !== undefined ? Number(g.gps_longitude) : null,
    capturedAt: g.captured_at,
  }));
}

export async function createVendorInvoiceWithThreeWayMatch(params: {
  projectId: string;
  po: any;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  invoiceFilePath?: string | null;
  priceTolerancePct?: number;
  notes?: string;
  invoiceLines: Array<{
    po_item_id: string;
    hsd_id?: string | null;
    item_name: string;
    ordered_qty: number;
    received_qty: number;
    po_unit_price: number;
    invoiced_qty: number;
    invoiced_unit_price: number;
  }>;
}): Promise<{ invoice: any; matchResult: ThreeWayMatchResult }> {
  const evidences = await getPoGrnEvidences(params.po.id);
  const matchResult = evaluateThreeWayMatch({
    items: params.invoiceLines.map((l) => ({
      itemName: l.item_name,
      orderedQty: l.ordered_qty,
      receivedQty: l.received_qty,
      invoicedQty: l.invoiced_qty,
      poUnitPrice: l.po_unit_price,
      invoiceUnitPrice: l.invoiced_unit_price,
    })),
    evidences,
    priceTolerancePct: params.priceTolerancePct ?? 1.0,
  });

  const invoicedQtyTotal = params.invoiceLines.reduce((s, l) => s + Number(l.invoiced_qty || 0), 0);
  const invoicedSubtotal = params.invoiceLines.reduce(
    (s, l) => s + Number(l.invoiced_qty || 0) * Number(l.invoiced_unit_price || 0),
    0
  );
  const ppnAmt = (invoicedSubtotal * Number(params.po.ppn_percent || 0)) / 100;
  const pphAmt = (invoicedSubtotal * Number(params.po.pph_percent || 0)) / 100;
  const grandTotal = invoicedSubtotal + ppnAmt - pphAmt;

  const { data: inv, error } = await supabase
    .from('vendor_invoices')
    .insert({
      project_id: params.projectId,
      po_id: params.po.id,
      vendor_id: params.po.vendor_id || null,
      invoice_number: params.invoiceNumber,
      invoice_date: params.invoiceDate,
      due_date: params.dueDate || null,
      invoiced_qty_total: invoicedQtyTotal,
      invoiced_subtotal: invoicedSubtotal,
      ppn_amount: ppnAmt,
      pph_amount: pphAmt,
      invoiced_grand_total: grandTotal,
      invoice_file_url: params.invoiceFilePath || null,
      price_tolerance_pct: params.priceTolerancePct ?? 1.0,
      qty_match_ok: matchResult.checks.qtyMatchOk,
      price_match_ok: matchResult.checks.priceMatchOk,
      evidence_match_ok: matchResult.checks.evidenceMatchOk,
      three_way_status: matchResult.status,
      match_notes: matchResult.reasons.join(' | ') || 'Three-Way Matching Lulus 100%',
      status: matchResult.canApprovePayment ? 'Verified' : 'Draft',
      notes: params.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const linePayloads = params.invoiceLines.map((l) => ({
    invoice_id: inv.id,
    po_item_id: l.po_item_id,
    hsd_id: l.hsd_id || null,
    item_name: l.item_name,
    invoiced_qty: Number(l.invoiced_qty),
    invoiced_unit_price: Number(l.invoiced_unit_price),
    invoiced_total: Number(l.invoiced_qty) * Number(l.invoiced_unit_price),
  }));

  const { error: lineErr } = await supabase.from('vendor_invoice_items').insert(linePayloads);
  if (lineErr) throw new Error(lineErr.message);

  await recordAuditEvent({
    projectId: params.projectId,
    tableName: 'vendor_invoices',
    action: 'INSERT',
    recordId: inv.id,
    newData: {
      invoice_number: params.invoiceNumber,
      three_way_status: matchResult.status,
      invoiced_grand_total: grandTotal,
    },
  });

  return { invoice: inv, matchResult };
}

export async function markVendorInvoicePaid(invoiceId: string, projectId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('vendor_invoices')
    .update({
      status: 'Paid',
      approved_by: userRes?.user?.id || null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('project_id', projectId);

  if (error) throw new Error(error.message);
}

// ==========================================
// 3. MULTI-WAREHOUSE, MATERIAL TRANSFER & STOCK OPNAME
// ==========================================
export async function listWarehouses(projectId: string) {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .or(`project_id.is.null,project_id.eq.${projectId}`)
    .eq('is_active', true)
    .order('warehouse_type', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function createWarehouse(payload: {
  project_id: string | null;
  code: string;
  name: string;
  warehouse_type: 'CENTRAL' | 'SITE';
  location?: string;
  pic_name?: string;
}) {
  const { data, error } = await supabase
    .from('warehouses')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listMaterialTransfers(projectId: string) {
  const { data, error } = await supabase
    .from('material_transfers')
    .select(`
      *,
      material:master_hsd(nama_item, satuan, harga_dasar),
      source_project:projects!material_transfers_source_project_id_fkey(name),
      target_project:projects!material_transfers_target_project_id_fkey(name)
    `)
    .or(`source_project_id.eq.${projectId},target_project_id.eq.${projectId}`)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    // Fallback tanpa explicit FK hint jika nama constraint berbeda
    const simple = await supabase
      .from('material_transfers')
      .select('*')
      .or(`source_project_id.eq.${projectId},target_project_id.eq.${projectId}`)
      .order('created_at', { ascending: false });
    return simple.data || [];
  }
  return data || [];
}

export async function createMaterialTransfer(payload: {
  transfer_number: string;
  source_project_id: string | null;
  target_project_id: string;
  source_warehouse_id?: string | null;
  target_warehouse_id?: string | null;
  hsd_id: string;
  quantity: number;
  unit_cost: number;
  notes?: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const total_cost = Number(payload.quantity) * Number(payload.unit_cost);
  const { data, error } = await supabase
    .from('material_transfers')
    .insert({
      ...payload,
      total_cost,
      requested_by: userRes?.user?.id || null,
      status: 'Pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function executeMaterialTransfer(transferId: string, projectId: string) {
  const { data, error } = await supabase.rpc('rpc_execute_material_transfer', {
    p_transfer_id: transferId,
  });
  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'material_transfers',
    action: 'APPROVE',
    recordId: transferId,
    newData: data as any,
  });
  return data;
}

export async function listStockOpnames(projectId: string) {
  const { data, error } = await supabase
    .from('stock_opnames')
    .select('*, items:stock_opname_items(*)')
    .eq('project_id', projectId)
    .order('opname_date', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return data || [];
}

export async function createStockOpname(
  header: {
    project_id: string;
    warehouse_id?: string | null;
    opname_number: string;
    opname_date: string;
    notes?: string;
    total_variance_value: number;
  },
  items: Array<{
    inventory_id?: string | null;
    hsd_id: string;
    item_name: string;
    unit: string;
    system_qty: number;
    physical_qty: number;
    variance_qty: number;
    unit_cost: number;
    variance_value: number;
    notes?: string;
  }>
) {
  const { data: userRes } = await supabase.auth.getUser();
  const { data: op, error } = await supabase
    .from('stock_opnames')
    .insert({
      ...header,
      conducted_by: userRes?.user?.id || null,
      status: 'Submitted',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const itemPayloads = items.map((i) => ({
    opname_id: op.id,
    inventory_id: i.inventory_id || null,
    hsd_id: i.hsd_id,
    item_name: i.item_name,
    unit: i.unit,
    system_qty: Number(i.system_qty),
    physical_qty: Number(i.physical_qty),
    variance_qty: Number(i.variance_qty),
    unit_cost: Number(i.unit_cost),
    variance_value: Number(i.variance_value),
    notes: i.notes || null,
  }));

  const { error: iErr } = await supabase.from('stock_opname_items').insert(itemPayloads);
  if (iErr) throw new Error(iErr.message);

  return op;
}

export async function approveStockOpname(opnameId: string, projectId: string) {
  const { data, error } = await supabase.rpc('rpc_approve_stock_opname', {
    p_opname_id: opnameId,
  });
  if (error) throw new Error(error.message);

  await recordAuditEvent({
    projectId,
    tableName: 'stock_opnames',
    action: 'APPROVE',
    recordId: opnameId,
    newData: data as any,
  });
  return data;
}
