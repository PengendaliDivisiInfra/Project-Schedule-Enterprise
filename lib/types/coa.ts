export type SAKCategory = 
  | 'Aset Lancar' 
  | 'Aset Tetap' 
  | 'Liabilitas Jangka Pendek' 
  | 'Liabilitas Jangka Panjang' 
  | 'Ekuitas' 
  | 'Pendapatan' 
  | 'Beban Pokok Proyek' 
  | 'Beban Operasional';

export type SaldoNormal = 'Debit' | 'Kredit';

export interface COA {
    id: string;
    tenant_id: string;
    kode_akun: string;
    nama_akun: string;
    kategori_sak: SAKCategory;
    saldo_normal: SaldoNormal;
    per_mandor: boolean;
    status: 'Aktif' | 'Inaktif';
    is_deleted?: boolean;
    created_at?: string;
    updated_at?: string;
}