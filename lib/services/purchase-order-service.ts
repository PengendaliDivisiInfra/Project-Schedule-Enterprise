// lib/services/purchase-order-service.ts
import { supabase } from '../supabase';
import type { Vendor, PurchaseOrder, POItem } from '@/types/purchase-order';

// ==========================================
// --- VENDOR SERVICE ---
// ==========================================
export async function getVendors(projectId: string): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('name');
    
  if (error) throw new Error(error.message);
  return data;
}

export async function createVendor(payload: Partial<Vendor>): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .insert(payload)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  return data;
}

// ==========================================
// --- PURCHASE ORDER SERVICE ---
// ==========================================
export async function getPurchaseOrders(projectId: string): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      vendor:vendors(name),
      items:purchase_order_items(
        id, 
        ordered_qty, 
        received_qty, 
        unit_price,
        master_hsd(nama_item, satuan)
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  return data;
}

export async function createPurchaseOrder(poHeader: Partial<PurchaseOrder>, items: POItem[]) {
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert(poHeader)
    .select()
    .single();

  if (poError) throw new Error(poError.message);

  const cleanItems = items.map(item => ({
    po_id: po.id,
    hsd_id: item.hsd_id,
    ordered_qty: item.ordered_qty,
    received_qty: item.received_qty,
    unit_price: item.unit_price,
    total_price: item.total_price
  }));

  const { error: itemError } = await supabase
    .from('purchase_order_items')
    .insert(cleanItems);

  if (itemError) throw new Error(itemError.message);
  return po;
}

export async function updatePurchaseOrder(poId: string, poHeader: Partial<PurchaseOrder>, items: POItem[]) {
  const { error: poError } = await supabase
    .from('purchase_orders')
    .update(poHeader)
    .eq('id', poId);

  if (poError) throw new Error(poError.message);

  const { error: deleteError } = await supabase
    .from('purchase_order_items')
    .delete()
    .eq('po_id', poId);
    
  if (deleteError) throw new Error(deleteError.message);

  const cleanItems = items.map(item => ({
    po_id: poId,
    hsd_id: item.hsd_id,
    ordered_qty: item.ordered_qty,
    received_qty: 0,
    unit_price: item.unit_price,
    total_price: item.total_price
  }));

  const { error: itemError } = await supabase
    .from('purchase_order_items')
    .insert(cleanItems);

  if (itemError) throw new Error(itemError.message);
}

export async function deletePurchaseOrder(poId: string) {
  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', poId);
    
  if (error) throw new Error(error.message);
}

// ==========================================
// --- GOODS RECEIPT (PENERIMAAN BARANG) ---
// ==========================================
export async function receiveGoods(
  poId: string, 
  poItemId: string, 
  receivedQty: number, 
  doNumber: string, 
  notes: string,
  projectId: string
) {
  const { error: grError } = await supabase.from('goods_receipts').insert({
    po_item_id: poItemId,
    received_qty: receivedQty,
    do_number: doNumber,
    notes: notes,
    received_date: new Date().toISOString().split('T')[0]
  });
  if (grError) throw new Error(grError.message);

  const { data: currentItem } = await supabase
    .from('purchase_order_items')
    .select('received_qty')
    .eq('id', poItemId)
    .single();
    
  const newReceivedQty = (currentItem?.received_qty || 0) + receivedQty;
  
  const { error: updateItemError } = await supabase
    .from('purchase_order_items')
    .update({ received_qty: newReceivedQty })
    .eq('id', poItemId);
  
  if (updateItemError) throw new Error(updateItemError.message);

  const { data: itemData } = await supabase
    .from('purchase_order_items')
    .select('hsd_id')
    .eq('id', poItemId)
    .single();
    
  if (itemData) {
    let { data: inv } = await supabase
      .from('inventory_materials')
      .select('id')
      .eq('project_id', projectId)
      .eq('hsd_id', itemData.hsd_id)
      .single();
    
    if (!inv) {
      const { data: newInv } = await supabase
        .from('inventory_materials')
        .insert({ project_id: projectId, hsd_id: itemData.hsd_id, stok_on_hand: 0 })
        .select('id')
        .single();
      inv = newInv;
    }

    if (inv) {
      await supabase.from('inventory_transactions').insert({
        inventory_id: inv.id,
        type: 'IN',
        quantity: receivedQty,
        reference: doNumber || 'Penerimaan PO',
        notes: `Penerimaan PO ID: ${poId}`
      });
    }
  }

  const { data: allItems } = await supabase
    .from('purchase_order_items')
    .select('ordered_qty, received_qty')
    .eq('po_id', poId);
  
  if (allItems) {
    const isCompleted = allItems.every(item => item.received_qty >= item.ordered_qty);
    const isPartial = allItems.some(item => item.received_qty > 0) && !isCompleted;
    const newStatus = isCompleted ? 'Completed' : (isPartial ? 'Partial' : 'Ordered');
    
    await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', poId);
  }
}

// ==========================================
// --- PEMBAYARAN PO (CASH FLOW INTEGRATION) ---
// ==========================================
export async function markPOAsPaid(poId: string, projectId: string, totalAmount: number, poNumber: string) {
  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({ 
      payment_status: 'Paid',
      payment_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', poId);

  if (updateError) throw new Error(updateError.message);

  const { error: cashError } = await supabase
    .from('cash_flows')
    .insert({
      project_id: projectId,
      transaction_date: new Date().toISOString().split('T')[0],
      type: 'OUT', 
      category: 'Material',
      amount: totalAmount,
      description: `Pembayaran PO: ${poNumber}`,
      reference_id: poId,
      vendor_or_ref: 'Purchase Order',
      approval_status: 'Approved' // <-- PERBAIKAN: Title Case
    });

  if (cashError) throw new Error(`Gagal mencatat arus kas: ${cashError.message}`);
}

// ==========================================
// --- PEMBATALAN PEMBAYARAN (VOID PAYMENT) ---
// ==========================================
export async function voidPOPayment(poId: string, projectId: string, totalAmount: number, poNumber: string) {
  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({ 
      payment_status: 'Unpaid',
      payment_date: null
    })
    .eq('id', poId);

  if (updateError) throw new Error(updateError.message);

  const { error: cashError } = await supabase
    .from('cash_flows')
    .insert({
      project_id: projectId,
      transaction_date: new Date().toISOString().split('T')[0],
      type: 'IN', 
      category: 'Material',
      amount: totalAmount,
      description: `[PEMBATALAN] Pembayaran PO: ${poNumber}`,
      reference_id: poId,
      vendor_or_ref: 'Void PO',
      approval_status: 'Approved' // <-- PERBAIKAN: Title Case
    });

  if (cashError) throw new Error(`Gagal mencatat pembatalan arus kas: ${cashError.message}`);
}