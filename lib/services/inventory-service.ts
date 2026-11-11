// lib/services/inventory-service.ts
import { supabase } from '../supabase';
import type { InventoryItem, InventoryTransaction } from '@/types/inventory';

// 1. Ambil semua material dari master_hsd, gabungkan dengan stok proyek saat ini
export async function getInventoryStock(projectId: string): Promise<InventoryItem[]> {
  // Ambil master material (Hanya tipe Bahan)
  const { data: hsdList, error: hsdError } = await supabase
    .from('master_hsd')
    .select('*')
    .in('tipe', ['bahan', 'material', 'Bahan']);

  if (hsdError) throw new Error(hsdError.message);

  // Ambil stok yang sudah tercatat di proyek ini
  const { data: invList, error: invError } = await supabase
    .from('inventory_materials')
    .select('*')
    .eq('project_id', projectId);

  if (invError) throw new Error(invError.message);

  // Gabungkan (Merge) data
  const merged: InventoryItem[] = hsdList.map(hsd => {
    const existingInv = invList?.find(inv => inv.hsd_id === hsd.id);
    
    return {
      id: existingInv?.id || '', // Jika belum ada stok, ID kosong
      project_id: projectId,
      hsd_id: hsd.id,
      stok_on_hand: existingInv?.stok_on_hand || 0,
      stok_minimum: existingInv?.stok_minimum || 0,
      lokasi_gudang: existingInv?.lokasi_gudang || 'Gudang Utama',
      updated_at: existingInv?.updated_at || new Date().toISOString(),
      master_hsd: {
        nama_item: hsd.nama_item,
        satuan: hsd.satuan,
        harga_dasar: hsd.harga_dasar,
        tipe: hsd.tipe
      }
    };
  });

  return merged.sort((a, b) => (a.master_hsd?.nama_item || '').localeCompare(b.master_hsd?.nama_item || ''));
}

// 2. Catat Transaksi (IN/OUT)
export async function recordTransaction(
  projectId: string, 
  hsdId: string, 
  type: 'IN' | 'OUT', 
  quantity: number, 
  reference: string, 
  notes: string
) {
  // Cek apakah record inventory sudah ada
  let { data: inv } = await supabase
    .from('inventory_materials')
    .select('id')
    .eq('project_id', projectId)
    .eq('hsd_id', hsdId)
    .single();

  // Jika belum ada, buat baru
  if (!inv) {
    const { data: newInv, error: createError } = await supabase
      .from('inventory_materials')
      .insert({ project_id: projectId, hsd_id: hsdId, stok_on_hand: 0 })
      .select('id')
      .single();
      
    if (createError) throw new Error(createError.message);
    inv = newInv;
  }

  // Masukkan transaksi (Trigger di DB akan otomatis update stok_on_hand)
  const { error: trxError } = await supabase
    .from('inventory_transactions')
    .insert({
      inventory_id: inv.id,
      type,
      quantity,
      reference,
      notes,
      transaction_date: new Date().toISOString().split('T')[0]
    });

  if (trxError) throw new Error(trxError.message);
}

// ==========================================
// --- FITUR BARU: HISTORY & KOREKSI ---
// ==========================================

// 3. Ambil History Transaksi berdasarkan inventory_id
export async function getMaterialHistory(inventoryId: string): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .eq('inventory_id', inventoryId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// 4. Revisi/Koreksi Transaksi (DENGAN PROTEKSI ENTERPRISE)
export async function updateTransaction(
  transactionId: string,
  newQty: number,
  newNotes: string,
  oldQty: number,
  type: 'IN' | 'OUT',
  inventoryId: string
) {
  // 🛡️ PROTEKSI LEVEL BACKEND (ANTI-BYPASS)
  // Ambil data asli dari database untuk memastikan ini bukan dari PO
  const { data: originalTrx, error: fetchError } = await supabase
    .from('inventory_transactions')
    .select('reference, notes')
    .eq('id', transactionId)
    .single();

  if (fetchError) throw new Error("Gagal memvalidasi keaslian transaksi.");

  const isFromPO = 
    originalTrx?.reference?.toLowerCase().includes('penerimaan po') || 
    originalTrx?.notes?.toLowerCase().includes('penerimaan po');

  if (isFromPO) {
    throw new Error("AKSES DITOLAK: Transaksi ini terikat dengan dokumen Purchase Order (PO). Silakan lakukan pembatalan (VOID) melalui menu Purchase Order.");
  }

  // Lanjut Update jika lolos proteksi
  const { error: trxError } = await supabase
    .from('inventory_transactions')
    .update({ 
      quantity: newQty, 
      notes: `${newNotes} [Direvisi dari ${oldQty}]` 
    })
    .eq('id', transactionId);

  if (trxError) throw new Error(trxError.message);

  // Sesuaikan stok_on_hand utama
  const diff = newQty - oldQty;
  const adjustment = type === 'IN' ? diff : -diff;

  if (adjustment !== 0) {
    const { data: inv } = await supabase.from('inventory_materials').select('stok_on_hand').eq('id', inventoryId).single();
    if (inv) {
      const newStock = inv.stok_on_hand + adjustment;
      await supabase.from('inventory_materials').update({ stok_on_hand: newStock }).eq('id', inventoryId);
    }
  }
}

export async function updateStokMinimum(inventoryId: string, hsdId: string, projectId: string, newMin: number) {
  if (!inventoryId) {
    const { error } = await supabase.from('inventory_materials').insert({
      project_id: projectId,
      hsd_id: hsdId,
      stok_minimum: newMin,
      stok_on_hand: 0
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('inventory_materials').update({ stok_minimum: newMin }).eq('id', inventoryId);
    if (error) throw new Error(error.message);
  }
}