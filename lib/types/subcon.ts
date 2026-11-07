export interface SignatureItem {
  title: string;
  name: string;
}

export interface Subcontractor {
  id: string;
  project_id: string;
  company_name: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  bank_name: string | null;
  bank_account: string | null;
  is_active: boolean;
}

export interface SubcontractorContract {
  id: string;
  project_id: string;
  subcontractor_id: string;
  spk_number: string;
  work_description: string;
  contract_value: number;
  retention_pct: number;
  ppn_pct: number;
  pph_pct: number;
  tax_mode: 'EXCLUDE' | 'INCLUDE' | 'NON_PAJAK'; // Baru
  status: 'Draft' | 'Active' | 'Completed' | 'Void';
  subcontractor_name?: string;
  total_addendum?: number;
  final_contract_value?: number;
}

export interface SubcontractorSPKItem {
  id?: string;
  contract_id?: string;
  description: string;
  volume: number;
  unit: string;
  unit_price: number;
  total_price?: number;
  is_active?: boolean;
}

export interface SubcontractorPayment {
  id: string;
  project_id: string;
  contract_id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  retention_amount: number;
  ppn_amount: number;
  pph_amount: number;
  payment_type: 'Kasbon' | 'Opname' | 'DP';
  progress_pct: number;
  description: string | null;
  created_at: string;
  status?: 'Pending' | 'Approved' | 'Paid'; 
}

export interface SubcontractorAddendum {
  id: string;
  contract_id: string;
  addendum_no: number;
  title: string;
  description: string | null;
  amount: number;
  old_contract_value: number;
  new_contract_value: number;
  created_at: string;
}

export interface AddendumItemChange {
  id?: string;
  action: 'ADD' | 'UPDATE' | 'DELETE';
  description: string;
  volume: number;
  unit: string;
  unit_price: number;
}

export interface BAPPData {
  contract: any;
  opnames: any[];
  kasbons: any[];
  potongan: any[];
  totalOpnameSdIni: number;
  totalKasbon: number;
  totalPotongan: number;
  baop_number: string | null; // Baru
  nilaiDP: number; // Baru
  signatures?: SignatureItem[];
}

export interface BPUTKItem {
  id: string;
  description: string;
  unit: string;
  volKontrak: number;
  hargaSatuan: number;
  jumlahKontrak: number;
  bobot: number;
  volLalu: number;
  nilaiLalu: number;
  volSaatIni: number;
  nilaiSaatIni: number;
  volSd: number;
  nilaiSd: number;
  volSisa: number;
  nilaiSisa: number;
}

export interface BPUTKData {
  contract: any;
  items: BPUTKItem[];
  totalKontrak: number;
  totalBobot: number;
  totalNilaiLalu: number;
  totalNilaiSaatIni: number;
  totalNilaiSd: number;
  totalNilaiSisa: number;
  totalKasbon: number;
  totalPotongan: number;
  signatures?: SignatureItem[];
}