# 📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO

**Status Proyek:** 🚀 Production Ready (V35-G - Enterprise Gold Standard)
**Terakhir Diperbarui:** 15 November 2026
**Environment Setup:** Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

## 1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115**, **PSAK 207**, dan **Project Balance Sheet**. 
Fokus V35-G adalah penyelesaian **Modul Manajemen Tenaga Kerja & Payroll (Manpower)**. Sistem menjamin perhitungan gaji akurat sesuai regulasi PP 35/2021, mendukung sistem *All-In*, dan terintegrasi otomatis ke HPP Upah (Laba Rugi) serta Arus Kas (PSAK 207). Dilengkapi dengan *Print Engine* standar HR (A4 Landscape) yang anti-terpotong.

## 2. IMPLEMENTED FEATURES (V35-G)

### A. Manajemen Tenaga Kerja & Payroll (V35-G)
- **Master Karyawan**: Mendukung Karyawan Bulanan (Office) dan Harian (Project). Dilengkapi fitur toggle **Sistem All-In (Lump Sum)**.
- **Absensi Harian**: Pencatatan Hadir, Sakit, Izin, dan Mangkir (Absent). Sinkronisasi dengan potongan gaji dan Uang Makan.
- **Generate Payroll**: Perhitungan Gaji Pokok, Tunjangan, Lembur (1/173), dan Uang Makan. Menerapkan prorata 21 hari untuk karyawan bulanan.
- **Auto-Cost Integration**: Saat Payroll di-Approve, otomatis insert ke `actual_costs` (Labor/Upah). Saat di-Pay, otomatis insert ke `cash_flows` (Kas Keluar).
- **Void Payroll**: Fitur pembatalan gaji yang mengembalikan Actual Cost dan mencatat pembalik Kas (*Soft Delete* pada semua baris terkait).
- **Print Engine (A4 Landscape)**: Menampilkan Laporan Pengajuan (Halaman 1) dan Slip Gaji (Halaman 2+) secara presisi. Dilengkapi *Watermark* VOID, Terbilang otomatis, Label RAHASIA, dan Footer korporat.

### B. Multi-Tenancy & Security Audit (V35-D s/d V35-G)
- **Database RLS**: Implementasi fungsi `is_project_member` dan `has_project_role` pada seluruh tabel inti.
- **Security Fallback**: User tanpa role proyek otomatis menjadi `Guest` (Akses Ditolak).
- **RBAC UI**: Tombol aksi krusial disembunyikan jika user tidak memiliki izin (misal: `can('MANAGE_COA')` untuk Edit Karyawan).

### C. Manajemen Gudang & Ledger (V35-F)
- **Buku Besar Mutasi (Ledger)**: Mencatat pergerakan material (IN/OUT) beserta No. PO, Invoice, dan spesifikasi.
- **Auto-Cost Integration**: Pemakaian material (OUT) otomatis masuk ke `actual_costs` (HPP/OPEX).
- **BBM Integration**: Pengadaan dan pengisian BBM ke alat tercatat sebagai IN/OUT.

### D. UI/UX Compliance (Zero `alert`/`confirm`)
- **Global Toast**: Seluruh notifikasi menggunakan Custom Event (`app-toast`).
- **Custom Modal**: Semua konfirmasi (Hapus, Void, Simpan) menggunakan Custom Modal.

## 3. ARCHITECTURE & CORE LOGIC
- **Database Triggers (Supabase)**: `log_daily_progress()` berjalan normal.
- **Print Engine Rules**: Menggunakan `@page { size: A4 landscape; }` dengan teknik *Absolute Footer* dan *Flexbox Wrapper* untuk mencegah tumpang tindih (overlap) dan halaman kosong.
- **Data Flow**: Absensi -> Generate Payroll -> Approve (P&L) -> Pay (Cash Flow) -> Cetak PDF.

## 4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Database**: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete (`is_deleted` / `voided_at`).
3. **Print Engine**: NO TAILWIND IN PDF, WAJIB `<table>` murni, ANTI PAGE-BREAK & BLANK PAGE.
4. **RLS**: Wajib update Row Level Security setiap membuat tabel/bucket baru.
5. **RBAC**: Setiap tombol aksi baru (Edit, Delete, Approve, Void) **WAJIB** dibungkus dengan hook `useRole`.

## 5. NEXT STEPS (ROADMAP SPRINT V35-H KE ATAS)

**FASE 1: Financial & Cost Control (Prioritas Utama)**
- **A. Variation Order (CCO)**: Pencatatan pekerjaan tambah/kurang (Addendum) yang otomatis meng-update Nilai Kontrak, RAP, dan P&L.
- **B. Cash Flow Forecasting**: Proyeksi Arus Kas 1-3 bulan ke depan berdasarkan komitmen PO, sisa termin, dan jadwal gaji.
- **C. Modul Rekonsiliasi Bank**: Upload CSV Mutasi Bank (BCA/Mandiri) vs Cash Flow (Auto-Matching).

**FASE 2: Operations & Field Management (Sisa)**
- **D. Multi-Warehouse**: Pemisahan stok antar gudang site (Gudang Pusat & Gudang Spillway) beserta fitur Stock Transfer.
- **E. Document Control & RFI**: Integrasi Supabase Storage untuk Shop Drawing/Addendum (Versioning, Link to WBS, RFI).

**FASE 3: Quality & Executive**
- **F. Upgrade Modul QHSE**: Digital checklist ITP, *Defect Tracking* (Punch List) dengan foto, dan *Safety Report* (K3).
- **G. Executive Multi-Project Dashboard**: Dasbor Owner untuk agregasi SPI, CPI, dan Margin dari seluruh proyek.

**FASE 4: Advanced Tech & Integration**
- **H. PWA & Offline Mode**: Optimasi Mobile-First untuk Site Engineer.
- **I. Integrasi WhatsApp Bot**: *Daily Report* otomatis ke Owner dan input progres via WA.
- **J. OCR Auto-Read Nota**: Scan Surat Jalan/Nota belanja.
- **K. Sinkronisasi API Pajak / e-Faktur (Opsional)**.

## 6. WORKFLOW GIT & DEPLOYMENT
1. `npm run build` (Pastikan 0 error, validasi TypeScript lolos).
2. `git add .`
3. `git commit -m "feat(V35-G): Complete Manpower & Payroll with PP 35/2021 Compliance & Enterprise Print Engine"`
4. `git push origin main` (Otomatis trigger Vercel).