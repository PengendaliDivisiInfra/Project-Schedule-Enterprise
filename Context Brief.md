# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V34.5-A)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V34.5-A)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)**, **PSAK 207 (Laporan Arus Kas)**, dan **Neraca Proyek (Project Balance Sheet)**. 
Fokus V34.5-A: **Project Balance Sheet (3-Kolom)**, **Audit Trail (Soft Delete History)**, **Penyempurnaan Enterprise Print Engine (Logo & TTD)**, dan **Sinkronisasi Lintas Laporan (P&L, Cash Flow, Neraca)**.

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/projects/[projectId]/reports/pnl/balance-sheet/page.jsx` : **BARU** - UI & Print Engine Neraca Proyek (3 Kolom + Executive Summary).
- `lib/services/balance-sheet.service.ts` : **BARU** - Service Layer perhitungan Neraca (Derived Query, tanpa tabel baru selain snapshot).
- `app/projects/[projectId]/reports/pnl/page.jsx` : **UPDATED** - Integrasi tombol navigasi ke Neraca & Audit Trail (Soft Delete).
- `components/finances/CashFlowStatementView.tsx` : **UPDATED** - Standarisasi Kop Surat (Logo) & Garis TTD.
- `app/sop/page.jsx` : Halaman SOP & Panduan Alur Input Harian (Interactive Checklist).
- `components/dashboard/ComplianceWidget.tsx` : Widget pengingat SOP di Dashboard.
- `lib/services/*` : Service Layer (PO, Subcon, Termin, Inventory, dll).

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V34.5-A)
- **Project Balance Sheet (Neraca Proyek)**:
  - Menjembatani P&L (Akrual) dan Cash Flow (Kas).
  - **3 Kolom Perbandingan**: Saldo Awal, Mutasi Periode, Saldo Akhir.
  - **Balance Guard**: Sistem memblokir cetak PDF jika Total Aset ≠ Total Liabilitas + Ekuitas.
  - **Zero Suppression**: Semua akun standar ditampilkan (meski Rp 0) untuk transparansi auditor.
  - **Executive Summary**: Menampilkan Nilai Kontrak, Pagu RAP, PoC, Total Tagihan, dan Sisa Kontrak.
- **Strict Accrual P&L (PSAK 115)**: Cost-to-Cost murni, Anti Laba Semu, CALK Rekonsiliasi.
- **Cash Flow (PSAK 207)**: Direct Method dengan pemisahan Operasi, Investasi, dan Pendanaan.
- **Audit Trail (Soft Delete)**: Snapshot laporan (`pnl_snapshots`, `balance_sheet_snapshots`) dapat dihapus dari UI, tetapi data asli tetap di database (`is_deleted = true`).

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal.
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at` / `is_deleted`).
3. **Print Engine (PDF) - PALING KRUSIAL**:
   - NO TAILWIND IN PDF: Wajib Inline Style / Pure CSS.
   - NO FLEXBOX/GRID IN PDF: Wajib `<table>` murni (termasuk untuk layout Kop Surat & Logo).
   - ANTI PAGE-BREAK: Gunakan `margin-top: auto;` pada kontainer bawah (TTD/Footer) di dalam Flexbox pembungkus A4 agar tidak menabrak tabel.
   - LOGO LIMIT: `max-height: 85px; max-width: 200px; object-fit: contain;`.
   - Wajib update RLS setiap membuat tabel/bucket baru.

## 5. CURRENT STATE (V34.5-A - PRODUCTION READY)
- **Material Management SELESAI**: Requirement Plan, Inventory, Purchase Order (GRN), Vendor, Laporan Premium.
- **Financial & P&L Engine SELESAI**: Dashboard Health, Aging AR/AP, Enterprise P&L Print Engine (Strict Accrual PSAK 115), Laporan Arus Kas (PSAK 207), Neraca Proyek (Balance), Snapshot History (Soft Delete).
- **SOP System SELESAI**: Halaman Interaktif `/sop`, Widget Dashboard, dan Contextual Alert.

## 6. NEXT STEPS (ROADMAP V34.5-B)
- A. **Modul Rekonsiliasi Bank**: Upload CSV Mutasi Bank vs Cash Flow (Auto-Matching).
- B. **Uji Coba End-to-End (E2E)**: Modul Operasional Lapangan (dari GRN, Opname, hingga Cetak Laporan).
- C. **Sinkronisasi API Pajak / e-Faktur (Opsional)**: Integrasi untuk validasi PPh Final.

---
**INSTRUCTION FOR AI:**
Anda adalah *Senior Tech Lead*. Jika diminta menulis kode, pastikan *Type-Safe*, sesuai *Folder Structure*, dan **100% PATUH** pada *Absolute Compliance Rules* (terutama PDF Engine dan UI Modal).