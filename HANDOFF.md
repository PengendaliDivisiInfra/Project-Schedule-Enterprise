📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO
Status Proyek: 🚀 Production Ready (V34.1 - Enterprise Grade)
Terakhir Diperbarui: 09 November 2026
Environment Setup: Next.js 14 (App Router), Vercel (Frontend), Railway/Puppeteer (PDF Microservice), Supabase (Database).

1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan arsitektur Multi-Tenant, standar akuntansi SAK ETAP Bab 23, dan kepatuhan perpajakan Indonesia (PPh 4(2) & PPN). Fokus rilis V34.1 adalah **Sinkronisasi Dokumen (Single Source of Truth)** dari SPK -> BPUTK -> BAPP/BAOP -> Kwitansi, **Pre-Audit SAK/KUP**, dan **Dynamic Chart of Accounts (COA)**.

2. IMPLEMENTED FEATURES (V34.1)
A. Master COA Dinamis (Baru)
- Tabel `chart_of_accounts` dengan RLS.
- Menu "Manajemen Kode Akun" (Create, Edit, Soft Delete/Inaktif).
- Hook `useCOA()` untuk menarik kode akun secara dinamis ke Kwitansi & BPUTK (tidak ada lagi hardcode 5101, 2121, dll).

B. Termin Klien & Jurnal SP2D (Baru)
- Modul input Termin Klien manual (karena pengajuan via Dinas).
- Input Nomor SP2D, SPM, NTPN.
- **Trigger Otomatis**: Saat SP2D diinput, sistem otomatis membuat Jurnal Umum (Debet Kas, Debet Piutang Retensi, Debet Beban PPh, Kredit Pendapatan, Kredit Utang PPN).

C. Subcontractor Workflow (Sinkronisasi & Anti Double Billing)
- **BPUTK** adalah *Single Source of Truth* (fisik). Status: `Belum Ditagih` / `Sudah Ditagih`.
- **BAPP & BAOP** menarik data dari BPUTK via dropdown. Tanggal dan volume terkunci otomatis.
- **Anti Double Billing**: BPUTK yang sudah ditarik ke BAPP/BAOP tidak akan muncul lagi di dropdown (`is_billed = true`).
- **Fitur Edit/Hapus**: 
  - BPUTK: Boleh diedit/hapus HANYA saat "Belum Ditagih".
  - BAPP/BAOP: Jika dihapus, sistem otomatis membuka kunci BPUTK terkait.
  - Kwitansi & Kasbon: Wajib *Soft Delete* (VOID) jika sudah masuk antrean Finance. Hard delete hanya boleh saat status `Pending`.

D. Payment Center (Persetujuan & Pembayaran)
- Tab baru khusus Finance/PM.
- Menggabungkan antrean Kasbon & Kwitansi (View SQL).
- **Compliance Engine (Pre-Audit)**: Sebelum tombol "Bayar" bisa diklik, sistem mengecek: Validasi Nominal, Kepatuhan Pajak (PPN/PPh), dan Keseimbangan Jurnal. Jika Audit Gagal (merah), pembayaran diblokir.

E. UI/UX Enterprise (Workflow Stepper & Guide Drawer)
- **WorkflowStepper**: Indikator horizontal (1. SPK -> 2. BPUTK -> 3. BAPP -> 4. Kwitansi -> 5. Bayar) di atas setiap halaman Subcon.
- **GuideDrawer**: Tombol melayang "Panduan" di kanan bawah, memunculkan Side Drawer berisi SOP spesifik sesuai tab yang sedang aktif.

3. ARCHITECTURE & CORE LOGIC
- **Financial Engine (`sak-calculator.ts`)**: Semua kalkulasi DPP, PPN, PPh, Retensi, Net Transfer WAJIB menggunakan `hitungSAK()`.
- **Snapshot / Freeze Data**: Nilai `nilai_dpp`, `nilai_ppn`, `nilai_pph`, dan `signatures` disimpan permanen ke database saat cetak, agar saat Reprint nilai historis tidak berubah.
- **PDF Microservice**: `/api/generate-pdf` (Next.js) -> Railway (Puppeteer).

4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. UI/UX: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib gunakan `ConfirmModal` atau Custom Modal.
2. Database: DILARANG Hard Delete pada data finansial (Kwitansi, Kasbon). Gunakan Soft Delete (status = 'Void').
3. Print Engine (Puppeteer):
   - NO TAILWIND IN PDF: Gunakan Inline Style/Pure CSS murni.
   - NO FLEXBOX/GRID IN PDF: Gunakan `<table>` murni untuk layout.
   - ANTI PAGE-BREAK: Container height di-lock (misal 185mm). Tanda tangan absolute bottom.
   - LOGO LIMIT: `max-height: 45px; max-width: 150px; object-fit: contain;`.
   - Wajib update RLS setiap membuat tabel baru.

5. NEXT STEPS (ROADMAP)
- A. Project Master Program (PMP) Print Engine (Cetak Tabel Resources & Materials).
- B. Cetak Form GAS Lainnya (Invoice Resmi, SPK Fisik).
- C. Modul Cash Flow Lanjutan (Dashboard Financial Health).

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