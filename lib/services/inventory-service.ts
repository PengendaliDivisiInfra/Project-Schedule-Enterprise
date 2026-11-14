// lib/services/inventory-service.ts
import { supabase } from '../supabase';
import type { InventoryItem, InventoryTransaction } from '@/types/inventory';

export async function getInventoryStock(projectId: string): Promise<InventoryItem[]> {
  const { data: hsdList, error: hsdError } = await supabase.from('master_hsd').select('*').in('tipe', ['bahan', 'material', 'Bahan']);
  if (hsdError) throw new Error(hsdError.message);

  const { data: invList, error: invError } = await supabase.from('inventory_materials').select('*').eq('project_id', projectId);
  if (invError) throw new Error(invError.message);

  const merged: InventoryItem[] = hsdList.map(hsd => {
    const existingInv = invList?.find(inv => inv.hsd_id === hsd.id);
    return {
      id: existingInv?.id || '', project_id: projectId, hsd_id: hsd.id,
      stok_on_hand: existingInv?.stok_on_hand || 0, stok_minimum: existingInv?.stok_minimum || 0,
      lokasi_gudang: existingInv?.lokasi_gudang || 'Gudang Utama', updated_at: existingInv?.updated_at || new Date().toISOString(),
      master_hsd: { nama_item: hsd.nama_item, satuan: hsd.satuan, harga_dasar: hsd.harga_dasar, tipe: hsd.tipe, kategori_akun: hsd.kategori_akun, spesifikasi: hsd.spesifikasi }
    };
  });
  return merged.sort((a, b) => (a.master_hsd?.nama_item || '').localeCompare(b.master_hsd?.nama_item || ''));
}

export async function getMaterialPOs(projectId: string, hsdId: string) {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select(`purchase_orders!inner(id, po_number, project_id, status)`)
    .eq('hsd_id', hsdId)
    .eq('purchase_orders.project_id', projectId)
    .not('purchase_orders.status', 'in', '("Void","Draft")');

  if (error) throw new Error(error.message);

  // PERBAIKAN TS ERROR FATAL: Menggunakan forEach ke dalam Map untuk menghindari error tipe array
  const uniqueMap = new Map<string, any>();
  (data || []).forEach((item: any) => {
    const po = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders;
    if (po && po.id) {
      uniqueMap.set(po.id, po);
    }
  });

  return Array.from(uniqueMap.values());
}

export async function getGlobalLedger(projectId: string) {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select(`*, inventory_materials!inner(project_id, master_hsd(nama_item, satuan, spesifikasi))`)
    .eq('inventory_materials.project_id', projectId)
    .is('voided_at', null) // Menyembunyikan data yang sudah di-void
    .order('transaction_date', { ascending: true }) 
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createMasterMaterial(payload: { nama_item: string, satuan: string, harga_dasar: number, kategori_akun: string, project_id: string }) {
  const { data, error } = await supabase.from('master_hsd').insert({
    nama_item: payload.nama_item, satuan: payload.satuan, harga_dasar: payload.harga_dasar,
    tipe: 'bahan', kategori_akun: payload.kategori_akun, is_ahsp: false, project_id: payload.project_id
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function recordTransaction(
  projectId: string, hsdId: string, type: 'IN' | 'OUT', quantity: number, 
  reference: string, notes: string, taskId?: string | null, resourceType: string = 'Material',
  poReference?: string, invoiceNumber?: string, equipmentId?: string
) {
  if (quantity <= 0) throw new Error("Jumlah transaksi harus lebih besar dari 0.");

  let { data: inv } = await supabase.from('inventory_materials').select('id').eq('project_id', projectId).eq('hsd_id', hsdId).single();
  if (!inv) {
    const { data: newInv, error: createError } = await supabase.from('inventory_materials').insert({ project_id: projectId, hsd_id: hsdId, stok_on_hand: 0 }).select('id').single();
    if (createError) throw new Error(createError.message);
    inv = newInv;
  }

  const { data: trx, error: trxError } = await supabase.from('inventory_transactions').insert({
    inventory_id: inv.id, type, quantity, reference, notes, 
    transaction_date: new Date().toISOString().split('T')[0],
    po_reference: poReference, invoice_number: invoiceNumber, equipment_id: equipmentId
  }).select('id').single();

  if (trxError) throw new Error(trxError.message);

  if (type === 'OUT') {
    const { data: hsd } = await supabase.from('master_hsd').select('harga_dasar').eq('id', hsdId).single();
    const costAmount = quantity * (hsd?.harga_dasar || 0);
    await supabase.from('actual_costs').insert({
      project_id: projectId, task_id: taskId || null, resource_type: resourceType, 
      cost_amount: costAmount, source_id: trx.id, reference_type: 'inventory_transaction',
      recorded_at: new Date().toISOString()
    });
  }
}

// --- FUNGSI BBM ---
export async function recordFuelReceipt(
  projectId: string, hsdId: string, poId: string, poNumber: string, 
  receiptDate: string, deliveryNote: string, licensePlate: string, 
  sealTop: string, sealBottom: string, volume: number
) {
  await supabase.from('fuel_receipts').insert({
    po_id: poId, receipt_date: receiptDate, delivery_note: deliveryNote,
    license_plate: licensePlate, seal_top: sealTop, seal_bottom: sealBottom, volume_received: volume
  });
  const keterangan = `SJ: ${deliveryNote} | Nopol: ${licensePlate} | Segel: ${sealTop}/${sealBottom}`;
  await recordTransaction(projectId, hsdId, 'IN', volume, 'Penerimaan BBM PO', keterangan, null, 'Material', poNumber, deliveryNote);
}

export async function recordFuelDispensing(
  projectId: string, hsdId: string, quantity: number, equipmentId: string, 
  equipmentName: string, hmValue: number, poReference: string
) {
  let finalHsdId = hsdId;
  if (!finalHsdId) {
    const { data } = await supabase.from('master_hsd').select('id').or('nama_item.ilike.%Solar%,nama_item.ilike.%BBM%').limit(1).maybeSingle();
    if (data) finalHsdId = data.id;
  }
  if (!finalHsdId) throw new Error("Master Material 'Solar' atau 'BBM' tidak ditemukan.");
  const notes = `Isi BBM ke ${equipmentName} (HM: ${hmValue})`;
  await recordTransaction(projectId, finalHsdId, 'OUT', quantity, 'Pengisian BBM', notes, null, 'Equipment', poReference, undefined, equipmentId);
}

// FUNGSI VOID TRANSAKSI
export async function voidTransaction(transactionId: string, inventoryId: string, qty: number, type: 'IN' | 'OUT') {
  const { error: trxError } = await supabase.from('inventory_transactions').update({ voided_at: new Date().toISOString() }).eq('id', transactionId);
  if (trxError) throw new Error(trxError.message);

  if (inventoryId) {
    const { data: inv } = await supabase.from('inventory_materials').select('stok_on_hand').eq('id', inventoryId).single();
    if (inv) {
      const adjustment = type === 'IN' ? -qty : qty; 
      await supabase.from('inventory_materials').update({ stok_on_hand: inv.stok_on_hand + adjustment }).eq('id', inventoryId);
    }
  }

  if (type === 'OUT') {
    await supabase.from('actual_costs').delete().eq('source_id', transactionId);
  }
}

export async function getMaterialHistory(inventoryId: string): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase.from('inventory_transactions').select('*').eq('inventory_id', inventoryId).is('voided_at', null).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateTransaction(transactionId: string, newQty: number, newNotes: string, oldQty: number, type: 'IN' | 'OUT', inventoryId: string) {
  if (newQty <= 0) throw new Error("Jumlah koreksi harus lebih besar dari 0.");
  
  const { data: originalTrx, error: fetchError } = await supabase.from('inventory_transactions').select('reference, notes').eq('id', transactionId).single();
  if (fetchError) throw new Error("Gagal memvalidasi transaksi.");

  const isFromPO = originalTrx?.reference?.includes('PO') || originalTrx?.notes?.includes('Penerimaan');
  if (isFromPO) throw new Error("AKSES DITOLAK: Transaksi dari PO/BBM tidak bisa diedit di sini. Gunakan VOID.");

  const { error: trxError } = await supabase.from('inventory_transactions').update({ quantity: newQty, notes: `${newNotes} [Revisi dari ${oldQty}]` }).eq('id', transactionId);
  if (trxError) throw new Error(trxError.message);

  const diff = newQty - oldQty;
  const adjustment = type === 'IN' ? diff : -diff;
  
  if (adjustment !== 0 && inventoryId) {
    const { data: inv } = await supabase.from('inventory_materials').select('stok_on_hand').eq('id', inventoryId).single();
    if (inv) await supabase.from('inventory_materials').update({ stok_on_hand: inv.stok_on_hand + adjustment }).eq('id', inventoryId);
  }
}

export async function updateStokMinimum(inventoryId: string, hsdId: string, projectId: string, newMin: number) {
  if (!inventoryId) {
    await supabase.from('inventory_materials').insert({ project_id: projectId, hsd_id: hsdId, stok_minimum: newMin, stok_on_hand: 0 });
  } else {
    await supabase.from('inventory_materials').update({ stok_minimum: newMin }).eq('id', inventoryId);
  }
}