# 📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO

**Status Proyek:** 🚀 Production Ready (V35-F - Enterprise Gold Standard)
**Terakhir Diperbarui:** 14 November 2026
**Environment Setup:** Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

## 1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115**, **PSAK 207**, dan **Project Balance Sheet**. 
Fokus V35-F adalah penyelesaian **Modul Manajemen Gudang (Warehouse Management)** terintegrasi, **Buku Besar Mutasi Material & BBM (Ledger)**, serta **Auto-Cost** ke WBS/Overhead yang terhubung langsung ke Laporan Laba Rugi (P&L) dan Arus Kas.

## 2. IMPLEMENTED FEATURES (V35-F)

### A. Multi-Tenancy & Security Audit (V35-D s/d V35-F)
- **Database RLS**: Implementasi fungsi `is_project_member` dan `has_project_role` pada seluruh tabel inti. Isolasi data 100%.
- **Security Fallback**: User tanpa role proyek otomatis menjadi `Guest` (Akses Ditolak).
- **No Service Role Leak**: `SERVICE_ROLE` hanya berjalan di server/API.
- **RBAC UI**: Tombol aksi krusial (Void, Koreksi, Tambah Transaksi) disembunyikan secara elegan menggunakan hook `useRole` jika user tidak memiliki izin (`EDIT_INVENTORY`).

### B. Setup Proyek Baru (Wizard) (V35-E)
- **3-Step Wizard**: UI interaktif di `/projects/new`.
- **Auto-Assign PM**: Otomatis mendaftarkan Admin sebagai `Project Manager`.
- **Auto-Redirect**: Langsung mengarahkan ke halaman `Tugas (WBS)`.

### C. Manajemen Gudang & Ledger (V35-F)
- **Buku Besar Mutasi (Ledger)**: Mencatat semua pergerakan material (IN/OUT) beserta No. PO, No. Invoice/SJ, Spesifikasi, dan keterangan.
- **Auto-Cost Integration**: Setiap pemakaian material (OUT) otomatis masuk ke tabel `actual_costs` (HPP WBS atau OPEX Overhead).
- **BBM Integration**: Tab Pengadaan BBM otomatis masuk ke Ledger sebagai IN. Pengisian BBM ke alat otomatis masuk sebagai OUT ke Ledger.
- **Koreksi & Void**: Fitur revisi jumlah (Auto-adjust stok) dan pembatalan transaksi (Void) dengan pengembalian stok otomatis.
- **Modal Penerimaan BBM**: Pencatatan Nopol, Segel Atas, dan Segel Bawah untuk audit logistik.
- **SOP & Panduan**: Tab baru di menu Material yang berisi *Golden Rules* dan panduan alur kerja harian.

### D. UI/UX Compliance (Zero `alert`/`confirm`)
- **Global Toast**: Seluruh notifikasi UI menggunakan Custom Event (`app-toast`).
- **Custom Modal**: Semua konfirmasi (Hapus, Void, Simpan) menggunakan Custom Modal.

## 3. ARCHITECTURE & CORE LOGIC
- **Database Triggers (Supabase)**: `log_daily_progress()` berjalan normal.
- **Schema Note**: RLS Policies terpasang ketat. Tidak ada `public` policy yang terbuka.
- **Data Flow**: Material (IN) -> Stok -> Material (OUT) -> Actual Cost -> P&L / Neraca.

## 4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Database**: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete (`is_deleted` / `voided_at`).
3. **Print Engine**: NO TAILWIND IN PDF, NO FLEXBOX/GRID, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. **RLS**: Wajib update Row Level Security setiap membuat tabel/bucket baru.
5. **RBAC (Role-Based Access Control)**: Setiap penambahan fitur/tombol aksi baru (Edit, Delete, Approve, Void) **WAJIB** dibungkus dengan hook `useRole` (contoh: `can('EDIT_INVENTORY')`). Dilarang membiarkan tombol krusial terekspos ke role `Guest` atau `Viewer`.

## 5. NEXT STEPS (ROADMAP SPRINT V35-G KE ATAS)

**FASE 1: Financial & Cost Control (Prioritas Utama)**
- **A. Variation Order (CCO)**: Pencatatan pekerjaan tambah/kurang (Addendum) yang otomatis meng-update Nilai Kontrak, RAP, dan P&L.
- **B. Cash Flow Forecasting**: Proyeksi Arus Kas 1-3 bulan ke depan berdasarkan komitmen PO, sisa termin, dan jadwal gaji.
- **C. Modul Rekonsiliasi Bank**: Upload CSV Mutasi Bank (BCA/Mandiri) vs Cash Flow (Auto-Matching).

**FASE 2: Operations & Field Management**
- **D. Manpower & Payroll**: Absensi harian mandor/pekerja, kalkulasi upah otomatis masuk ke Actual Cost WBS (Upah) dan Kas Keluar.
- **E. Multi-Warehouse**: Pemisahan stok antar gudang site (Gudang Pusat & Gudang Spillway) beserta fitur Stock Transfer.
- **F. Document Control & RFI**: Integrasi Supabase Storage untuk Shop Drawing/Addendum (Versioning, Link to WBS, RFI).

**FASE 3: Quality & Executive**
- **G. Upgrade Modul QHSE**: Digital checklist ITP, *Defect Tracking* (Punch List) dengan foto, dan *Safety Report* (K3).
- **H. Executive Multi-Project Dashboard**: Dasbor Owner untuk agregasi SPI, CPI, dan Margin dari seluruh proyek.

**FASE 4: Advanced Tech & Integration**
- **I. PWA & Offline Mode**: Optimasi Mobile-First untuk Site Engineer, simpan input progres di IndexedDB (sinkron saat ada sinyal).
- **J. Integrasi WhatsApp Bot**: *Daily Report* otomatis ke Owner dan input progres via WA.
- **K. OCR Auto-Read Nota**: Scan Surat Jalan/Nota belanja untuk memotong waktu input logistik.
- **L. Sinkronisasi API Pajak / e-Faktur (Opsional)**.

## 6. WORKFLOW GIT & DEPLOYMENT
1. `npm run build` (Pastikan 0 error, validasi TypeScript lolos).
2. `git add .`
3. `git commit -m "feat(V35-F): Complete Warehouse Management, Ledger & BBM Integration"`
4. `git push origin main` (Otomatis trigger Vercel).