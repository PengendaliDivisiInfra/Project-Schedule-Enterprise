📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO
Status Proyek: 🚀 Production Ready (V34.4 - Enterprise Grade)
Terakhir Diperbarui: 11 November 2026
Environment Setup: Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115** (Pendapatan Kontrak) dan **PSAK 207** (Laporan Arus Kas). Fokus V34.4 mencakup Strict Accrual P&L Engine, Laporan Arus Kas Direct Method, dan sistem Compliance (SOP) otomatis untuk memastikan akurasi data lapangan.

2. IMPLEMENTED FEATURES (V34.4)
A. Financial & P&L Engine (PSAK 115)
- **Strict Accrual Basis**: Pendapatan diakui menggunakan metode Cost-to-Cost (PoC). Membaca data dari Penerimaan Barang (GRN), Opname Subkon, dan Jurnal Akrual. 
- **Anti Laba Semu**: Sistem memblokir cetak laporan jika Actual Cost masih Rp 0.
- **CALK Rekonsiliasi**: Otomatis menghitung Aset Kontrak (Unbilled Receivable) atau Liabilitas Kontrak (Unearned Revenue).
- **Enterprise Print Engine**: Layout A4 Formal (Times New Roman), dikunci dalam 1 halaman, TTD Dinamis.

B. Cash Flow Statement (PSAK 207)
- **Direct Method**: Pemisahan tegas antara Aktivitas Operasi, Investasi, dan Pendanaan (Droping).
- **Cost Breakdown**: Rincian pengeluaran operasi (Material, Upah, Subkon & Alat, Operasional).
- **Sinkronisasi**: Laporan Kas (Net) selaras dengan Tagihan Bruto (P&L).

C. Interactive SOP & Compliance (BARU)
- **Halaman `/sop`**: Panduan interaktif (Checklist Admin) dengan instruksi navigasi langsung ke menu yang dituju.
- **Compliance Widget**: Muncul di Dashboard untuk mengingatkan tim terkait PO yang belum di-GRN dan Kas Harian yang belum diinput.
- **Contextual Alert**: Peringatan otomatis di halaman Cash Flow & P&L jika ada SOP yang terlewat.

D. Material Management & Supply Chain
- **Requirement Plan**: Kalkulasi otomatis kebutuhan material dari WBS & AHSP.
- **Inventory (Stok Gudang)**: Fitur *History*, Koreksi Transaksi, dan Input Stok Minimum.
- **Purchase Order (PO)**: Mendukung *Input Manual*, *Partial Payment*, dan *Progress Tracking* (GRN).

3. ARCHITECTURE & CORE LOGIC
- **Supabase Schema Note**: Tabel `profiles` menggunakan kolom **`full_name`**. Tabel `actual_costs` digunakan untuk Jurnal Akrual. Tabel `pnl_snapshots` & `cash_flow_snapshots` untuk Audit Trail.
- **Print CSS Trick**: Menggunakan `display: flex; flex-direction: column;` pada kontainer utama cetak. Elemen `margin-top: auto` digunakan pada blok TTD/Footer agar selalu berada di bawah tanpa menabrak tabel.

4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. UI/UX: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal.
2. Database: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete.
3. Print Engine: NO TAILWIND IN PDF, NO FLEXBOX/GRID IN PDF, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. Wajib update RLS setiap membuat tabel/bucket baru.

5. NEXT STEPS (ROADMAP V34.5)
- A. Modul Rekonsiliasi Bank (Upload CSV Mutasi vs Cash Flow).
- B. Sinkronisasi API Pajak / e-Faktur (Opsional).
- C. Uji Coba End-to-End (E2E) Modul Operasional Lapangan.

6. WORKFLOW GIT & DEPLOYMENT
1. `npm run build` (Pastikan 0 error, validasi TypeScript lolos).
2. `git add .`
3. `git commit -m "feat(V34.4): Strict PSAK 115 P&L, PSAK 207 Cash Flow & Interactive SOP"`
4. `git push origin main` (Otomatis trigger GitHub Actions -> Vercel).

Konfirmasi Serah Terima:
Dokumen ini mendokumentasikan V34.4 secara komprehensif. Seluruh aturan mutlak terkait Print Engine, pemisahan UI/PDF, logika Accrual P&L, Cash Flow, dan SOP telah didokumentasikan dengan standar Enterprise tertinggi. Proyek siap untuk dilanjutkan ke fase Rekonsiliasi Bank.