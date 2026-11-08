📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO
Status Proyek: 🚀 Production Ready (V34 - Enterprise Grade)
Terakhir Diperbarui: 08 November 2026
Environment Setup: Next.js 14 (App Router), Vercel (Frontend), Railway/Puppeteer (PDF Microservice), Supabase (Database).

1. EXECUTIVE SUMMARY
InfraControl PRO telah bertransformasi secara fundamental menjadi Sistem ERP Konstruksi Terpadu (Enterprise-Grade). Sistem ini dirancang dengan arsitektur Multi-Tenant, standar akuntansi SAK ETAP Bab 23, dan kepatuhan perpajakan Indonesia (PPh 4(2) & PPN). Fokus dari rilis V34 ini adalah Immutability (Pembekuan Data Historis) dan High-Fidelity Print Engine untuk dokumen legal berskala Corporate.

2. IMPLEMENTED FEATURES (STATUS SAAT INI)
A. Core Modules (Resources, Termin, Vault)

Resource & Material Plan: Histogram S-Curve, Kalkulasi AHSP, Net Requirement, PO (PPN/PPh), Goods Receipt.

Termin / Cash In: Multi-tenant isolation (RLS), Auto-Approve, Reversing Journal (Void Payment).

Document Vault: Penyimpanan dokumen legal dan foto progress terpusat (Supabase Storage) dengan Signed URLs.

B. Subcontractor & Financial Management

Manajemen Vendor: SPK (RAB), Addendum (CCO) otomatis, dan integrasi Audit Trail System (audit_logs).

Kasbon & Opname Workflow: Pemisahan fitur Pengajuan Kasbon (status default Pending) dan Pencairan Opname. Dilengkapi fungsi Terbilang presisi.

C. High-Fidelity Print Engine (PDF Document Generation)

BAOP (Berita Acara Opname): Layout A4 Portrait, Kop Surat dinamis, tanpa garis tabel (minimalis).

BAPP (Berita Acara Pembayaran Prestasi): Layout A4 Landscape, kalkulasi live (SAK/KUP), Billing Statement.

BPUTK (Biaya Pembayaran Upah): Layout A3 Landscape, Inline Edit Progress dengan Soft Validation (peringatan visual tanpa blokir input), dan Overlap Date Checker (Custom Modal).

Lampiran BAPP: Auto-Fetch data dari No. BAPP terpilih. Merender Timeline transaksi (Opname, Kasbon, Potongan) secara kronologis dan menghitung SAK/KUP otomatis.

Kwitansi (BARU): Menarik data dari Chart of Accounts (COA) secara dinamis. Fitur Auto-Fill (SAK) untuk menarik nilai Gross, PPN, PPh, dan Retensi. Desain Ledger-Style (A4 Landscape) yang sangat premium.

3. ARCHITECTURE & CORE LOGIC (V34 UPGRADE)
A. Dynamic Signatures & Freeze Data (Snapshot)

Reusable Component: Ekstraksi UI ke SignatureSettings.tsx untuk digunakan di BAPP, BPUTK, Kasbon, dan Lampiran BAPP.

JSONB Database: Kolom signatures ditambahkan ke bapp_documents, bputk_documents, dan subcontractor_payments.

Reprint Protocol (Anti-Drift): Logika Cetak Ulang (Reprint) tidak lagi menggunakan kalkulasi engine terbaru. Sistem membaca data yang dibekukan (snapshot) dari database (nilai_dpp, nilai_ppn, signatures) untuk menjamin dokumen historis tidak berubah saat ada update pajak di masa depan.

B. Approval Workflow (Finance Panel)

Menu persetujuan baru (ApprovalWorkflowView.tsx) untuk memproses Kasbon/Opname berstatus Pending menjadi Approved atau Paid.

C. Financial & Tax Engine Integration

Kalkulasi pajak (SAK/KUP) di seluruh dokumen cetak menggunakan hitungSAK() terpusat (mendukung mode EXCLUDE, INCLUDE, NON_PAJAK).

Auto-Fill pada Kwitansi memetakan hasil hitung engine ke Kode Akun standar (5101.001, 2121.001, dll).

4. 🛑 ABSOLUTE RULES (LESSONS LEARNED)
UI/UX: DILARANG menggunakan alert(), confirm(), atau prompt(). Gunakan komponen CustomModal.

Keuangan: DILARANG Hard Delete pada data finansial. Gunakan Soft Delete atau Reversing Journal.

Akses: Gunakan useRole() dan can('PERMISSION_KEY'). Jangan menulis logika RBAC manual di UI.

Print Engine (Puppeteer):

DILARANG menggunakan class Tailwind (className) di area cetak (id="print-area"). WAJIB menggunakan Inline Style atau Pure CSS di dalam string HTML.

Anti Page-Break: Container PDF WAJIB di-lock tingginya (misal height: 185mm) dan Tanda Tangan menggunakan position: absolute; bottom: 20px; atau margin-top: auto di dalam Flex Container.

Anti Logo Raksasa: Wajib memberikan inline style max-height: 45px; max-width: 150px; object-fit: contain; pada tag <img> logo kop surat.

Pure Table Layout: DILARANG menggunakan display: flex atau grid untuk menyusun layout 3 kolom di PDF. Gunakan <table>, <tr>, dan <td> murni (misal pada Lampiran BAPP dan Kwitansi) untuk memastikan presisi tinggi.

Database: DILARANG SELECT * pada View kompleks. Wajib update RLS (Row Level Security) setiap membuat tabel baru. Selalu gunakan format desimal Indonesia (koma) pada tampilan UI.

5. DATABASE SCHEMA UPDATE (V34)
Tabel Cetak (Dokumen) & Pembayaran:

bapp_documents, bputk_documents, baop_documents.

subcontractor_payments (Kolom baru: status, signatures).

subcon_receipts (Tabel baru: Menyimpan histori Kwitansi, total_gross, total_deduction, total_net, details JSONB untuk list COA).

Kolom Krusial yang Ditambahkan:

signatures (JSONB) -> Tersimpan di 3 tabel dokumen.

tax_mode -> Tersimpan di SPK.

nilai_dpp, nilai_ppn, nilai_pph -> Tersimpan di tabel dokumen (untuk keperluan Snapshot Cetak Ulang).

6. NEXT STEPS (ROADMAP)
A. Project Master Program (PMP) Print Engine

□ UI Cetak Tabel PMP - Resources (Crews).
□ UI Cetak Tabel PMP - Materials.
□ Integrasi ke data tasks (WBS), resources, dan materials.
B. Cetak Form GAS Lainnya

□ Invoice Resmi (A4 Portrait).
□ Surat Perintah Kerja (SPK) / Kontrak fisik.
C. Modul Cash Flow Lanjutan

□ Rekonsiliasi Bank Otomatis.
□ Dashboard Financial Health (Profit/Loss per proyek).
7. WORKFLOW GIT & DEPLOYMENT
(Standar Operasional Prosedur)

npm run build (Pastikan 0 error, validasi TypeScript lolos).

git add .

git commit -m "feat(V34): [Deskripsi Perubahan]"

git push origin main (Otomatis trigger GitHub Actions -> Vercel/Railway).

Konfirmasi Serah Terima:
Dokumen ini mendokumentasikan V34 secara komprehensif. Seluruh aturan mutlak terkait Print Engine, pemisahan UI/PDF, logika pembekuan data (Snapshot), dan skema database terbaru telah didokumentasikan dengan standar Enterprise tertinggi. Proyek siap untuk dilanjutkan ke fase pengembangan berikutnya.