# 📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO

**Status Proyek:** 🚀 Production Ready (V35-I - Enterprise Gold Standard)
**Terakhir Diperbarui:** 15 November 2026
**Environment Setup:** Next.js 14, Vercel, Supabase (PostgreSQL, RLS, Storage), PWA (Service Worker, Dexie).

## 1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115**, **PSAK 207**, dan **Project Balance Sheet**. 
Fokus V35-I adalah implementasi **PWA (Progressive Web App) & Offline Mode**. Sistem kini dapat di-*install* di perangkat mobile (Android/iOS), dilengkapi *Bottom Navigation*, dan memiliki kemampuan *Offline-First*. Data dasbor, keuangan, dan WBS disimpan di *Local Cache* (localStorage), sementara input lapangan (Progres) disimpan di *IndexedDB* (Dexie) dan disinkronkan otomatis saat online.

## 2. IMPLEMENTED FEATURES

### A. PWA & Offline Mode (V35-I)
- **Service Worker**: Menggunakan `@ducanh2912/next-pwa`. Mencakup *caching* halaman (`NetworkFirst`), aset statis (`StaleWhileRevalidate`), dan RSC Payload untuk navigasi instan.
- **Local Cache System**: Menggunakan `lib/utils/cache.js` untuk menyimpan data Supabase (Dasbor, Gantt, Tugas, Keuangan) ke `localStorage`. Saat offline, halaman memuat data terakhir secara instan tanpa *loading* lama.
- **Offline Input (IndexedDB)**: Menggunakan `Dexie` untuk antrean sinkronisasi (saat ini diimplementasikan di `/progress`). Data yang diinput saat offline akan dikirim ke Supabase saat koneksi kembali.
- **Mobile UI**: Penambahan `BottomNav.jsx` (khusus layar mobile) dan indikator status Online/Offline di `Header.jsx`.
- **Robust Auth Middleware**: Memperbaiki konfigurasi Supabase SSR dan Middleware agar Google SSO berjalan lancar, serta mencegah *redirect loop* atau *MIME type error* saat berpindah halaman dalam mode offline.

### B. Cash Flow & Financials (V35-H)
- **Cost Control Fix**: Memperbaiki View `v_cost_control_wbs` (menambahkan `project_id` dan `security_invoker`) untuk mengatasi error 400 Bad Request pada halaman Arus Kas.
- **Forecasting**: Proyeksi kas 3 bulan (Inflow/Outflow) & Cetak PDF A4 Landscape.

### C. Manpower & Payroll (V35-G)
- **Master Karyawan**: Sistem All-In dan Harian.
- **Auto-Cost**: Payroll `Approved` insert ke `actual_costs`, `Paid` insert ke `cash_flows`.

## 3. ARCHITECTURE & CORE LOGIC
- **Data Fetching**: Menggunakan pola *Local-First*. Cek `getFromCache()` -> Cek `navigator.onLine` -> Jika online, `fetch` ke Supabase -> `saveToCache()`.
- **Print Engine Rules**: Menggunakan `@page { size: A4 landscape; }` dengan teknik **`<table>` murni (NO FLEXBOX/GRID)** dan *Absolute Footer* untuk mencegah tumpang tindih (overlap) dan halaman kosong.
- **Schema & RLS**: RLS aktif di semua tabel. View `v_cost_control_wbs` menggunakan `security_invoker = true` agar RLS tabel dasar berlaku pada View.

## 4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Database**: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete (`is_deleted` / `voided_at`).
3. **Print Engine**: NO TAILWIND IN PDF, **NO FLEXBOX/GRID**, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. **RLS**: Wajib update Row Level Security setiap membuat tabel/bucket baru.
5. **RBAC**: Setiap tombol aksi baru **WAJIB** dibungkus dengan hook `useRole`.

## 5. NEXT STEPS (ROADMAP SPRINT V35-I KE ATAS)

**FASE 1: Financial & Cost Control (Sisa)**
- **A. Variation Order (CCO)**: Pencatatan pekerjaan tambah/kurang (Addendum) yang otomatis meng-update Nilai Kontrak, RAP, dan P&L.
- **B. Modul Rekonsiliasi Bank**: Upload CSV Mutasi Bank vs Cash Flow.

**FASE 2: Operations & Field Management**
- **C. Multi-Warehouse**: Pemisahan stok antar gudang site beserta fitur Stock Transfer.
- **D. Document Control & RFI**: Integrasi Supabase Storage untuk Shop Drawing/Addendum.

**FASE 3: Quality & Executive**
- **E. Upgrade Modul QHSE**: Digital checklist ITP, Defect Tracking, Safety Report.
- **F. Executive Multi-Project Dashboard**: Agregasi SPI, CPI, dan Margin dari seluruh proyek.

**FASE 4: Advanced Tech**
- **G. PWA & Offline Mode**: ✅ SELESAI (V35-I).
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