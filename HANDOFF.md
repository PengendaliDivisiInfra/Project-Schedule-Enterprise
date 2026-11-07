# Project Handoff Document - InfraControl PRO
Status Proyek: 🚀 Production Ready (V30 - Enterprise RBAC, Finance, Subcontractor & PMP Print)
Terakhir Diperbarui: 08 November 2026
Developer Utama: [Nama Anda]
Environment Setup: Windows PowerShell (Local), Vercel (Frontend), Railway (PDF Microservice), Supabase (Database)

## 1. Status Saat Ini (Implemented Features)
Aplikasi InfraControl PRO telah bertransformasi menjadi Sistem ERP Konstruksi Terpadu.

### A. Modul Resource Plan, Material Plan, & Finance (Selesai)
- Histogram S-Curve, Kalkulasi AHSP, Net Requirement, PO (PPN/PPh), Goods Receipt.
- Auto-Approve, Reversing Journal (Void Payment), integrasi PO ke Kas.

### B. Modul Termin / Cash In (Selesai)
- Multi-tenant isolation (RLS), RBAC (Owner, PM, Site Admin, DCC, QC, HSE).
- Sinkronisasi otomatis dengan Master Proyek.
- Perhitungan PPN, PPh, dan Retensi otomatis.
- Integrasi ke Cash Flow (Ledger Kas Masuk).

### C. Modul Document & Photo Vault (Selesai)
- Penyimpanan dokumen legal dan foto progress terpusat (Supabase Storage).
- Menggunakan *Signed URLs* untuk keamanan akses file.

### D. Modul Subcontractor Management (Selesai)
- Manajemen Vendor, SPK (RAB), dan Addendum (CCO) otomatis.
- Pembayaran Opname (berdasarkan persentase progres) dan Kasbon.
- Kalkulasi PPN, PPh, dan Retensi Fleksibel.
- **Mesin Kalkulasi SAK & KUP (`lib/utils/sak-calculator.ts`)** untuk auto-audit.
- **Audit Trail System** (`audit_logs`) mencatat semua perubahan data secara transparan.

### E. Modul Project Master Program (PMP) - *In Progress*
- Rencana Cetak PDF untuk Resources (Crews) & Materials.
- Mengadopsi standar GAS Script (SAK & KUP) ke dalam UI Next.js.

## 2. 🛑 LESSONS LEARNED (Larangan & Keharusan Mutlak)
- JANGAN gunakan `alert()`, `confirm()`, atau `prompt()` bawaan browser.
- JANGAN lakukan Hard Delete pada data finansial (gunakan Soft Delete / Jurnal Pembalik).
- JANGAN menulis logika hak akses manual. Gunakan `useRole()` dan `can('PERMISSION_KEY')`.
- JANGAN gunakan `SELECT *` pada View kompleks tanpa type casting eksplisit.
- JANGAN git push jika `npm run build` masih merah.
- SELALU sinkronkan Role di database dengan `lib/config/permissions.ts`.
- SELALU gunakan format desimal Indonesia (koma) & `MoneyText` untuk masking harga.
- SELALU gunakan Custom Modal Confirmation untuk aksi destruktif.

## 3. Skema Database Krusial (Jangan Diubah!)
- `v_resource_requirements`, `task_material_requirements`, `master_hsd`, `purchase_orders`, `cash_flows`, `project_members`.
- **New:** `subcontractors`, `subcontractor_contracts`, `subcontractor_spk_items`, `subcontractor_addendums`, `subcontractor_payments`, `subcon_opnames`, `subcon_financial_logs`.

## 4. Roadmap Tersisa (Next Steps)
Tinggal 2 modul pamungkas untuk menyempurnakan aplikasi:
A. **Project Master Program (PMP) Print Engine**
   □ Membuat UI untuk mencetak tabel PMP - Resources (Crews).
   □ Membuat UI untuk mencetak tabel PMP - Materials.
   □ Integrasi ke data `tasks` (WBS), `resources`, dan `materials`.
B. **Cetak Form GAS Lainnya**
   □ BPUTK (Biaya Pembayaran Upah Tenaga Kerja).
   □ BAOP (Berita Acara Opname Pekerjaan).
   □ BAPP (Berita Acara Pembayaran Prestasi).
   □ Invoice & Kwitansi.

## 5. Workflow Git & Deployment
(Standar: `npm run build` -> `git add .` -> `git commit -m "..."` -> `git push origin main`)