📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO
Status Proyek: 🚀 Production Ready (V34.5-A - Enterprise Grade)
Terakhir Diperbarui: 12 November 2026
Environment Setup: Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115** (Pendapatan Kontrak), **PSAK 207** (Laporan Arus Kas), dan **Project Balance Sheet**. Fokus V34.5-A mencakup penyelesaian modul Neraca Proyek (Project Balance Sheet) dengan keseimbangan 3 kolom (Saldo Awal, Mutasi, Saldo Akhir), penyempurnaan Enterprise Print Engine (Logo & TTD Dinamis), serta implementasi Audit Trail (Soft Delete History) di seluruh laporan keuangan.

2. IMPLEMENTED FEATURES (V34.5-A)
A. Project Balance Sheet (Neraca Proyek)
- **Auto-Balance Logic**: Menarik data dari P&L dan Cash Flow, memisahkan Aset Kontrak vs Liabilitas Kontrak, serta mengakomodasi selisih PPh Final (SP2D).
- **3 Kolom Perbandingan**: Menampilkan Saldo Awal, Mutasi, dan Saldo Akhir secara sejajar.
- **Zero Suppression**: Menampilkan seluruh akun PSAK (meski Rp 0) untuk keperluan audit.
- **Executive Summary**: Kotak ringkasan Kontrak, RAP, PoC, dan Sisa Tagihan.
- **Balance Guard**: Validasi otomatis (Variance = 0) sebelum tombol cetak diaktifkan.

B. Audit Trail & History
- **P&L & Balance Sheet Snapshots**: Menyimpan data JSON laporan.
- **Soft Delete**: Custom Modal untuk "menghapus" snapshot dari UI, tanpa menghilangkan data asli di database (`is_deleted = true`).

C. Enterprise Print Engine (PDF Standardization)
- **Seragam di 3 Laporan**: P&L, Cash Flow, dan Neraca kini menggunakan Kop Surat (Logo & Teks) yang identik, menggunakan teknik *Nested Table* (patuh aturan *No Flexbox in PDF*).
- **Dynamic Signature**: 3 Kolom tanda tangan dengan nama, jabatan, dan garis bawah tegas.

3. ARCHITECTURE & CORE LOGIC
- **Supabase Schema Note**: 
  - `profiles` menggunakan kolom `full_name`.
  - `actual_costs` untuk Jurnal Akrual.
  - `pnl_snapshots` & `cash_flow_snapshots` & `balance_sheet_snapshots` untuk Audit Trail.
- **Print CSS Trick**: Menggunakan `display: flex; flex-direction: column;` pada kontainer utama cetak. Elemen `margin-top: auto` pada blok TTD/Footer.

4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. UI/UX: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal.
2. Database: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete.
3. Print Engine: NO TAILWIND IN PDF, NO FLEXBOX/GRID IN PDF, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. Wajib update RLS setiap membuat tabel/bucket baru.

5. NEXT STEPS (ROADMAP V34.5-B)
- A. Modul Rekonsiliasi Bank (Upload CSV Mutasi Bank vs Cash Flow) Skip.
- B. Uji Coba End-to-End (E2E) Modul Operasional Lapangan Skip.
- C. Sinkronisasi API Pajak / e-Faktur (Opsional) Skip.

6. WORKFLOW GIT & DEPLOYMENT
1. `npm run build` (Pastikan 0 error, validasi TypeScript lolos).
2. `git add .`
3. `git commit -m "feat(V34.5-A): Project Balance Sheet & Audit Trail Soft Delete"`
4. `git push origin main` (Otomatis trigger GitHub Actions -> Vercel).

Konfirmasi Serah Terima:
Dokumen ini mendokumentasikan V34.5-A secara komprehensif. Seluruh aturan mutlak terkait Print Engine, Neraca Proyek, dan Audit Trail telah didokumentasikan dengan standar Enterprise tertinggi. Proyek siap untuk dilanjutkan ke fase Rekonsiliasi Bank (V34.5-B).