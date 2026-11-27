// types/purchase-order.ts

export interface Vendor {
  id: string;
  project_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  is_active: boolean;
  is_centralized?: boolean;
  vendor_code?: string | null;
  npwp_number?: string | null;
  pkp_status?: 'PKP' | 'NON_PKP' | string | null;
  pkp_expiry_date?: string | null;
  legal_expiry_date?: string | null;
  is_blacklisted?: boolean;
  blacklist_reason?: string | null;
  avg_score?: number | null;
  score_grade?: string | null;
}

export interface POItem {
  id?: string;
  po_id?: string;
  hsd_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_price: number;
  total_price: number;
  
  // Properti untuk Manual Input
  is_manual?: boolean;
  manual_name?: string;
  manual_unit?: string;
  kategori_akun?: string;

  master_hsd?: {
    nama_item: string;
    satuan: string;
  };
}

export interface PurchaseOrder {
  id: string;
  project_id: string;
  vendor_id: string;
  po_number: string;
  po_date: string;
  status: 'Draft' | 'Ordered' | 'Partial' | 'Completed';
  
  // PERBAIKAN: Tambahkan 'Partially Paid' di sini
  payment_status: 'Unpaid' | 'Partially Paid' | 'Paid';
  payment_date: string | null;
  
  // PERBAIKAN: Tambahkan properti paid_amount
  paid_amount: number;

  subtotal: number;
  ppn_percent: number;
  ppn_amount: number;
  pph_percent: number;
  pph_amount: number;
  grand_total: number;
  shipping_address: string | null;
  wbs_code?: string | null;
  pr_id?: string | null;
  approval_chain?: string[];
  required_approval_steps?: number;
  notes: string | null;
  vendor?: Vendor;
  items?: POItem[];
}