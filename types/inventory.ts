// types/inventory.ts

export interface InventoryItem {
  id: string;
  project_id: string;
  hsd_id: string;
  stok_on_hand: number;
  stok_minimum: number;
  lokasi_gudang: string | null;
  updated_at: string;
  master_hsd?: {
    nama_item: string;
    satuan: string;
    harga_dasar: number;
    tipe: string;
    kategori_akun?: string;
  };
}

export interface InventoryTransaction {
  id: string;
  inventory_id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  reference: string | null;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}