# 📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO

**Status Proyek:** 🚀 Production Ready (V35-H - Enterprise Gold Standard)
**Terakhir Diperbarui:** 15 November 2026
**Environment Setup:** Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

## 1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115**, **PSAK 207**, dan **Project Balance Sheet**. 
Fokus V35-H adalah penyelesaian **Modul Financial & Cost Control (Cash Flow Forecasting)** serta penyempurnaan **Manpower & Payroll (V35-G)**. Sistem menjamin perhitungan gaji akurat (PP 35/2021) dan menyajikan proyeksi arus kas 3 bulan ke depan berdasarkan piutang dan hutang aktif, lengkap dengan *Enterprise Print Engine* (A4 Landscape).

## 2. IMPLEMENTED FEATURES (V35-G & V35-H)

### A. Cash Flow Forecasting (V35-H)
- **Proyeksi 3 Bulan**: Mengalkulasi *Inflow* (dari Invoice Klien Outstanding) dan *Outflow* (dari Hutang Subkon).
- **Visualisasi Data**: Grafik Bar Chart interaktif (Recharts) dan tabel rincian proyeksi.
- **Print Engine (A4 Landscape)**: Mencetak laporan proyeksi dengan Kop Surat dinamis, *Watermark*, dan TTD 3 Pihak (Pengaturan TTD tersimpan di `localStorage`).

### B. Manpower & Payroll (V35-G)
- **Master Karyawan**: Mendukung Bulanan (Office) dan Harian (Project), fitur toggle **Sistem All-In**.
- **Absensi Harian**: Sinkronisasi potongan gaji dan Uang Makan (Hadir, Sakit, Izin, Mangkir).
- **Auto-Cost Integration**: Payroll `Approved` insert ke `actual_costs` (HPP Upah). Payroll `Paid` insert ke `cash_flows`.

### C. Multi-Tenancy & Security Audit (V35-D s/d V35-H)
- **Database RLS**: Implementasi `is_project_member` dan `has_project_role`.
- **RBAC UI**: Tombol aksi krusial disembunyikan menggunakan hook `useRole`.

### D. UI/UX Compliance (Zero `alert`/`confirm`)
- **Global Toast**: Menggunakan Custom Event (`app-toast`).
- **Custom Modal**: Semua konfirmasi (Hapus, Void, Simpan) menggunakan Custom Modal.

## 3. ARCHITECTURE & CORE LOGIC
- **Print Engine Rules**: Menggunakan `@page { size: A4 landscape; }` dengan teknik **`<table>` murni (NO FLEXBOX/GRID)** dan *Absolute Footer* untuk mencegah tumpang tindih (overlap) dan halaman kosong.
- **Data Flow**: Absensi -> Payroll -> P&L (Actual Cost) -> Cash Flow -> Forecast.

## 4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Database**: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete (`is_deleted` / `voided_at`).
3. **Print Engine**: NO TAILWIND IN PDF, **NO FLEXBOX/GRID**, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. **RLS**: Wajib update Row Level Security setiap membuat tabel/bucket baru.
5. **RBAC**: Setiap tombol aksi baru **WAJIB** dibungkus dengan hook `useRole`.

## 5. NEXT STEPS (ROADMAP SPRINT V35-I KE ATAS)

**FASE 1: Financial & Cost Control (Sisa)**
- **A. Variation Order (CCO)**: Pencatatan pekerjaan tambah/kurang (Addendum) yang otomatis meng-update Nilai Kontrak, RAP, dan P&L.
- **B. Modul Rekonsiliasi Bank**: Upload CSV Mutasi Bank (BCA/Mandiri) vs Cash Flow (Auto-Matching).

**FASE 2: Operations & Field Management**
- **C. Multi-Warehouse**: Pemisahan stok antar gudang site beserta fitur Stock Transfer.
- **D. Document Control & RFI**: Integrasi Supabase Storage untuk Shop Drawing/Addendum.

**FASE 3: Quality & Executive**
- **E. Upgrade Modul QHSE**: Digital checklist ITP, Defect Tracking, Safety Report.
- **F. Executive Multi-Project Dashboard**: Agregasi SPI, CPI, dan Margin dari seluruh proyek.

**FASE 4: Advanced Tech**
- **G. PWA & Offline Mode**: Optimasi Mobile-First.
- **H. Integrasi WhatsApp Bot**: Daily Report & Input via WA.
- **I. OCR Auto-Read Nota**: Scan Surat Jalan/Nota.

## 6. WORKFLOW GIT & DEPLOYMENT (ENTERPRISE STANDARD)
1. Buat branch baru: `git checkout -b feat/V35-I-nama-fitur`.
2. Lakukan *development* dan jalankan `npm run build` (Pastikan 0 error).
3. `git add .` lalu `git commit -m "feat(V35-I): Deskripsi Fitur"`.
4. `git push -u origin feat/V35-I-nama-fitur` (Otomatis trigger Vercel Preview).
5. Lakukan QA di Link Preview Vercel.
6. Buat Pull Request (PR) di GitHub, lalu Merge ke `main`.
7. Vercel otomatis deploy ke Production.