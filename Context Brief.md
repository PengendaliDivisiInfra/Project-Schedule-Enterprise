# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V34.4)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V34.4)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)** dan **PSAK 207 (Laporan Arus Kas)**. 
Fokus V34.4: **Strict Accrual P&L Engine**, **Interactive SOP & Compliance System**, **Cash Flow Statement (Direct Method)**, dan penyempurnaan **Enterprise PDF Print Engine**.

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/sop/page.jsx` : **BARU** - Halaman SOP & Panduan Alur Input Harian (Interactive Checklist).
- `components/dashboard/ComplianceWidget.tsx` : **BARU** - Widget pengingat SOP (GRN & Kas Harian) di Dashboard.
- `components/finances/CashFlowStatementView.tsx` : **BARU** - Print Engine & UI Laporan Arus Kas PSAK 207.
- `app/projects/[projectId]/reports/pnl/page.jsx` : **UPDATED** - P&L Engine PSAK 115 (Cost-to-Cost, Anti Laba Semu).
- `app/finances/page.jsx` : **UPDATED** - Halaman Cash Flow (Ledger, Cost Control, Dashboard Health, Aging AR/AP, Contextual SOP Alert).
- `app/dashboard/page.jsx` : **UPDATED** - Integrasi Compliance Widget.
- `components/Sidebar.jsx` : Layout Utama (telah di-*update* menambahkan menu SOP & Panduan).
- `lib/services/*` : Service Layer (PO, Subcon, Termin, Inventory, dll).

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V34.4)
- **Strict Accrual P&L (PSAK 115)**:
  - Pendapatan diakui berdasarkan **PoC (Percentage of Completion)** murni Cost-to-Cost (`Qualified Actual Cost / Total RAP`).
  - **Qualified Actual Cost**: Biaya yang diakui dikurangi Stok Material Belum Terpasang dan Kasbon/DP Subkon.
  - **No Fallback**: Jika Actual Cost = 0, Pendapatan = 0 (mencegah laba semu).
  - **CALK Rekonsiliasi**: Otomatis menghitung *Unbilled Receivable* (Aset Kontrak) atau *Unearned Revenue* (Liabilitas Kontrak).
- **Cash Flow (PSAK 207)**:
  - Metode Langsung (Direct Method) dengan pemisahan Aktivitas Operasi, Investasi, dan Pendanaan (Droping).
  - Rincian pengeluaran operasi (Material, Upah, Subkon & Alat, Operasional).
- **Interactive SOP System**:
  - Widget *Daily Compliance Check* di Dashboard.
  - *Contextual SOP Alert* di halaman Cash Flow & P&L (Memberi peringatan jika ada input yang terlewat sebelum cetak laporan).
- **Dynamic Signature (TTD)**: Pengaturan nama & jabatan pada PDF disimpan di `LocalStorage` (auto-save).
- **Schema Note**: Tabel `profiles` menggunakan kolom **`full_name`**. Tabel `actual_costs` digunakan untuk menampung Jurnal Akrual (Upah/Alat).

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal.
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at`).
3. **Print Engine (PDF) - PALING KRUSIAL**:
   - NO TAILWIND IN PDF: Wajib Inline Style / Pure CSS.
   - NO FLEXBOX/GRID IN PDF: Wajib `<table>` murni.
   - ANTI PAGE-BREAK: Gunakan `margin-top: auto;` pada kontainer bawah (TTD/Footer) di dalam Flexbox pembungkus A4 agar tidak menabrak tabel.
   - LOGO LIMIT: `max-height: 85px; max-width: 200px; object-fit: contain;` (untuk kop surat tengah).
   - Wajib update RLS setiap membuat tabel/bucket baru.

## 5. CURRENT STATE (V34.4 - PRODUCTION READY)
- **Material Management SELESAI**: Requirement Plan, Inventory, Purchase Order (GRN), Vendor, Laporan Premium.
- **Financial & P&L Engine SELESAI**: Dashboard Health, Aging AR/AP, Enterprise P&L Print Engine (Strict Accrual PSAK 115), Laporan Arus Kas (PSAK 207), Snapshot History.
- **SOP System SELESAI**: Halaman Interaktif `/sop`, Widget Dashboard, dan Contextual Alert.

## 6. NEXT STEPS (ROADMAP V34.5)
- A. Modul Rekonsiliasi Bank (Upload CSV Mutasi vs Cash Flow).
- B. Sinkronisasi API Pajak / e-Faktur (Opsional).
- C. Uji Coba End-to-End (E2E) Modul Operasional Lapangan.

---
**INSTRUCTION FOR AI:**
Anda adalah *Senior Tech Lead*. Jika diminta menulis kode, pastikan *Type-Safe*, sesuai *Folder Structure*, dan **100% PATUH** pada *Absolute Compliance Rules* (terutama PDF Engine dan UI Modal).