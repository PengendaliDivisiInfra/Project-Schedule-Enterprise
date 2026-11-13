# 📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO

**Status Proyek:** 🚀 Production Ready (V35-C - Enterprise Gold Standard)
**Terakhir Diperbarui:** 15 November 2026
**Environment Setup:** Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

## 1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115**, **PSAK 207**, dan **Project Balance Sheet**. Fokus V35-C mencakup penyelesaian tuntas **Modul Alat & BBM Tahap 2** (Kontrak, Virtual Tank, BAR), integrasi *Historical S-Curve*, serta perbaikan logika EVM (Proporsional vs PV).

## 2. IMPLEMENTED FEATURES (V35-C)

### A. Equipment & Fuel Management (Phase 2)
- **Kontrak Sewa (PO)**: Konfigurasi Tarif, Kuota (Jam/Hari), Batas Normal, Aturan Lembur (Potong Kuota/Terpisah).
- **Virtual Fuel Tank**: Pelacakan sisa BBM alat secara *real-time* (Running Balance) berdasarkan HM dan Standar Rasio. Angka minus dibiarkan sebagai indikator audit.
- **Approval Workflow**: Timesheet berstatus `Draft` hingga di-`Approve` oleh pengawas. Hanya data `Approved` yang masuk ke kalkulasi BAR.
- **Anomali Defisit BBM**: Sistem mendeteksi jika Sisa BBM bernilai minus, menampilkan *Warning Banner* (Opsi C), dan menyediakan *Custom Modal Audit* (Opsi B) berisi rekonsiliasi matematis.
- **BAR (Berita Acara Rekonsiliasi)**: Menghitung otomatis Tagihan Reguler, Overtime, dan Potongan BBM. PDF dicetak 1 halaman penuh dengan Kop Surat Dinamis dan Tanda Tangan Tripartit.

### B. Enterprise UI Gold Standard
- **Sticky Columns**: Kolom WBS & Nama Tugas pada halaman Tasks tetap terlihat saat scroll horizontal.
- **Dashboard Premium**: EVM KPI, S-Curve proporsional, Y-Axis dinamis.
- **Modal Redesign**: Seluruh form input menggunakan *Custom Modal* elegan (Zero `alert()`).

## 3. ARCHITECTURE & CORE LOGIC
- **Database Triggers (Supabase)**:
  - `log_daily_progress()`: Mencatat historis `progress_percent` dari `wbs_tasks` setiap ada UPDATE.
  - Fungsi RPC / Edge Functions untuk kalkulasi agregasi berat.
- **Schema Note**: 
  - Tabel Inti: `projects`, `wbs_tasks`, `daily_progress`, `actual_costs`, `cash_flows`.
  - Tabel Alat: `equipment_units` (dengan `initial_fuel`, `current_fuel`), `fuel_tanks`, `fuel_transactions`, `equipment_contracts`, `equipment_timesheets`, `equipment_bars`.

## 4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal.
2. **Database**: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete (`is_deleted` / `voided_at`).
3. **Print Engine**: NO TAILWIND IN PDF, NO FLEXBOX/GRID, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. **RLS**: Wajib update Row Level Security setiap membuat tabel/bucket baru.

## 5. NEXT STEPS (ROADMAP SPRINT V35-D)
- **A. Modul Rekonsiliasi Bank (CSV Upload)**: 
  Fitur unggah mutasi rekening bank (BCA/Mandiri/BRI) untuk dicocokkan dengan Arus Kas (Auto-Matching).
- **B. Fitur "Setup Proyek Baru" (Wizard)**: 
  Membuat panduan interaktif untuk memandu Admin melakukan inisialisasi proyek baru (Kalender, WBS, Baseline).
- **C. Sinkronisasi API Pajak / e-Faktur (Opsional)**.

## 6. WORKFLOW GIT & DEPLOYMENT
1. `npm run build` (Pastikan 0 error, validasi TypeScript lolos).
2. `git add .`
3. `git commit -m "feat(V35-C): Equipment Phase 2, Virtual Tank, BAR PDF Engine"`
4. `git push origin main` (Otomatis trigger GitHub Actions -> Vercel).