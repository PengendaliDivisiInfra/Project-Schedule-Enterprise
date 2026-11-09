📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO
Status Proyek: 🚀 Production Ready (V34.1 - Enterprise Grade)
Terakhir Diperbarui: 09 November 2026
Environment Setup: Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi SAK ETAP Bab 23 dan kepatuhan perpajakan Indonesia (PPh 4(2) & PPN). Fokus V34.1 adalah Sinkronisasi Dokumen, Pre-Audit SAK/KUP, Dynamic COA, dan High-Fidelity Print Engine (PMP & Subcon/SPK).

2. IMPLEMENTED FEATURES (V34.1)
A. Master COA & Termin Klien
- COA dinamis via `useCOA()`.
- SP2D auto-journal (Debet Kas, Kredit Pendapatan, dll).

B. Subcontractor Workflow (Sinkronisasi & Anti Double Billing)
- BPUTK sebagai *Single Source of Truth*. Status `is_billed` mencegah *double billing*.
- BAPP/BAOP menarik data BPUTK via dropdown terkunci.
- Soft Delete diterapkan pada Kwitansi, Kasbon, dan SPK.

C. Payment Center (Persetujuan & Pembayaran)
- Menggabungkan antrean Kasbon & Kwitansi.
- **Compliance Engine (Pre-Audit)**: Memblokir pembayaran jika validasi pajak/DPP/Netto gagal.

D. UI/UX Enterprise (Workflow Stepper & Guide Drawer)
- Terintegrasi di setiap halaman Subcon.

E. **SPK & Master Vendor Print Engine (BARU)**
- **Master Vendor Upgrade**: CRUD lengkap, Dropdown Kualifikasi SBU (PP 9/2022), dan Upload KTP.
- **Form SPK**: Mendukung Mode Pajak (Exclude/Include/Non-Pajak). Tarif PPh otomatis ditarik dari Master Vendor. Validasi input (PPN/PPh disabled jika Non-Pajak).
- **PDF Engine A4**: Layout presisi, TTD Dinamis (Nama & Jabatan), penomoran halaman otomatis (`Halaman X dari Y`), Kotak Paraf di footer, dan format BQ dengan garis putus-putus.

F. PMP Print Engine (A3)
- Mencetak 4 halaman (Time Schedule, EVM Matrix, Resources, Materials) via Railway Puppeteer.

3. ARCHITECTURE & CORE LOGIC
- **Financial Engine (`sak-calculator.ts`)**: Kalkulasi DPP, PPN, PPh, Retensi WAJIB via `hitungSAK()`.
- **Snapshot / Freeze Data**: Nilai `nilai_dpp`, `nilai_ppn`, `nilai_pph` disimpan permanen saat cetak (reprint membaca snapshot).
- **PDF Microservice**: `/api/generate-pdf` (Next.js) -> Railway (Puppeteer). Mendukung `footerTemplate` untuk penomoran halaman.
- **Supabase Storage**: Bucket `ktp_documents` (Public) digunakan untuk upload KTP Mandor di form SPK.

4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. UI/UX: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib `ConfirmModal` atau Custom Modal.
2. Database: DILARANG Hard Delete pada data finansial. Gunakan Soft Delete (status = 'Void').
3. Print Engine (Puppeteer):
   - NO TAILWIND IN PDF: Inline Style/Pure CSS murni.
   - NO FLEXBOX/GRID IN PDF: `<table>` murni.
   - ANTI PAGE-BREAK: Multi-page gunakan `@page` margin (bawah 45mm) dan `position: fixed` untuk footer paraf. Single page gunakan `height: 185mm`.
   - LOGO LIMIT: `max-height: 45px; max-width: 150px; object-fit: contain;`.
   - Wajib update RLS setiap membuat tabel/bucket baru.

5. NEXT STEPS (ROADMAP)
- A. Cetak Form GAS Lainnya (Invoice Resmi A4, Kontrak Fisik).
- B. Modul Cash Flow Lanjutan (Dashboard Financial Health / Profit-Loss).

6. WORKFLOW GIT & DEPLOYMENT
npm run build (0 error) -> git add . -> git commit -m "feat(V34): [Deskripsi]" -> git push origin main.

7. WORKFLOW GIT & DEPLOYMENT
(Standar Operasional Prosedur)

npm run build (Pastikan 0 error, validasi TypeScript lolos).

git add .

git commit -m "feat(V34): [Deskripsi Perubahan]"

git push origin main (Otomatis trigger GitHub Actions -> Vercel/Railway).

Konfirmasi Serah Terima:
Dokumen ini mendokumentasikan V34 secara komprehensif. Seluruh aturan mutlak terkait Print Engine, pemisahan UI/PDF, logika pembekuan data (Snapshot), dan skema database terbaru telah didokumentasikan dengan standar Enterprise tertinggi. Proyek siap untuk dilanjutkan ke fase pengembangan berikutnya.