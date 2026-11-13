📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO
Status Proyek: 🚀 Production Ready (V35-A - Enterprise Gold Standard)
Terakhir Diperbarui: 13 November 2026
Environment Setup: Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115** (Pendapatan Kontrak), **PSAK 207** (Laporan Arus Kas), dan **Project Balance Sheet**. Fokus V35-A mencakup transformasi Dasbor Eksekutif (EVM S-Curve Proporsional, Alert Overbudget), penyempurnaan modul Neraca Proyek (3 Kolom), Enterprise Print Engine (Logo & TTD Dinamis), Audit Trail (Soft Delete), serta **Lokalisasi 100% Bahasa Indonesia** pada antarmuka pengguna.

2. IMPLEMENTED FEATURES (V35-A)
A. Enterprise Dashboard (Gold Standard)
- **EVM Metrics Akurat**: SPI, CPI, dan Progres Berbobot dihitung menggunakan Cost-Weighted Progress.
- **S-Curve Proporsional**: Garis EV dan AC di-plot mengikuti lekukan PV (Plan) secara proporsional dan terpotong tepat di tanggal hari ini (Cut-Off Date).
- **Safety Guard**: Peringatan merah otomatis jika Total Anggaran (RAB) melebihi Nilai Kontrak.

B. Project Balance Sheet (Neraca Proyek)
- **Auto-Balance Logic**: Menarik data dari P&L dan Cash Flow, memisahkan Aset Kontrak vs Liabilitas Kontrak, serta mengakomodasi selisih PPh Final (SP2D).
- **3 Kolom Perbandingan**: Menampilkan Saldo Awal, Mutasi, dan Saldo Akhir secara sejajar.
- **Zero Suppression**: Menampilkan seluruh akun PSAK (meski Rp 0) untuk keperluan audit.
- **Balance Guard**: Validasi otomatis (Variance = 0) sebelum tombol cetak diaktifkan.

C. Audit Trail & Print Engine
- **Soft Delete**: Custom Modal untuk "menghapus" snapshot dari UI, tanpa menghilangkan data asli di database (`is_deleted = true`).
- **Seragam di 3 Laporan**: P&L, Cash Flow, dan Neraca menggunakan Kop Surat (Logo & Teks) identik (Nested Table).
- **Dynamic Signature**: 3 Kolom tanda tangan dengan nama, jabatan, dan garis bawah tegas.

D. Equipment & Fuel Management (Tahap 1)
- **Anti-Fraud Fuel Ratio**: Validasi konsumsi BBM (L/Jam) berdasarkan Work Load (Low/Medium/High).
- **Smart Info Box**: Tampilan standar operasional (Kapasitas Tangki & L/Jam) secara real-time.

3. ARCHITECTURE & CORE LOGIC
- **Supabase Schema Note**: 
  - `profiles` menggunakan kolom `full_name`.
  - `actual_costs` untuk Jurnal Akrual.
  - `pnl_snapshots`, `cash_flow_snapshots`, & `balance_sheet_snapshots` untuk Audit Trail.
  - `equipment_units`, `fuel_tanks`, `fuel_transactions`, `equipment_contracts`, `equipment_timesheets` untuk Modul Alat & BBM.
- **Print CSS Trick**: Menggunakan `display: flex; flex-direction: column;` pada kontainer utama cetak. Elemen `margin-top: auto` pada blok TTD/Footer.

4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. UI/UX: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal.
2. Database: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete.
3. Print Engine: NO TAILWIND IN PDF, NO FLEXBOX/GRID IN PDF, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. Wajib update RLS setiap membuat tabel/bucket baru.

5. NEXT STEPS (ROADMAP SPRINT V35-B)
*(Catatan: Roadmap sebelumnya seperti Rekonsiliasi Bank, E2E Test, dan API Pajak di-skip/ditunda. Fokus beralih ke peningkatan UI/UX dan Integrasi Data Historis).*

- **A. Penerapan "Gold Standard" UI ke Modul Lain**: 
  Menerapkan tema *Midnight Blue*, font *tabular*, dan tipografi premium yang sudah sukses di Dashboard ke halaman **Tasks (WBS)** dan **Gantt Workspace**.
- **B. Integrasi `daily_progress` (Historical S-Curve)**: 
  Membuat fitur input harian (Timekeeper) agar pergerakan kurva S-Curve ke depan bisa terekam secara historis per hari, tidak hanya dihitung ulang dari `progress_percent` saat ini.
- **C. Modul Rekonsiliasi Bank (CSV Upload)**: 
  Fitur unggah mutasi rekening bank (BCA/Mandiri/BRI) untuk dicocokkan dengan Arus Kas (Auto-Matching).
- **D. Sempurnakan Modul Alat & BBM (Tahap 2)**: 
  Melanjutkan pembuatan modul Kontrak Sewa, Timesheet Harian (HM Awal/Akhir), dan Logika Minimum Charge/Breakdown.

6. WORKFLOW GIT & DEPLOYMENT
1. `npm run build` (Pastikan 0 error, validasi TypeScript lolos).
2. `git add .`
3. `git commit -m "feat(V35-A): Enterprise Dashboard Gold Standard & Full ID Localization"`
4. `git push origin main` (Otomatis trigger GitHub Actions -> Vercel).

Konfirmasi Serah Terima:
Dokumen ini mendokumentasikan V35-A secara komprehensif. Seluruh aturan mutlak terkait Print Engine, Neraca Proyek, EVM Dashboard, dan Audit Trail telah didokumentasikan dengan standar Enterprise tertinggi. Proyek siap untuk dilanjutkan ke Sprint V35-B.