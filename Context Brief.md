# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V35-A)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V35-A)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)**, **PSAK 207 (Laporan Arus Kas)**, dan **Neraca Proyek (Project Balance Sheet)**. 
Fokus V35-A: **Enterprise Dashboard (Gold Standard)**, **EVM S-Curve Sinkronisasi**, **Project Balance Sheet (3-Kolom)**, **Audit Trail (Soft Delete History)**, **Penyempurnaan Enterprise Print Engine (Logo & TTD)**, dan **Lokalisasi 100% Bahasa Indonesia**.

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/dashboard/page.jsx` : **UPDATED** - Dasbor Eksekutif Enterprise (EVM KPI, S-Curve Proporsional, Alert Overbudget).
- `app/api/analytics/scurve/route.js` : **UPDATED** - Logic EVM Cut-off & Proportional EV mapping.
- `components/Sidebar.jsx` : **UPDATED** - UI Midnight Blue, Collapsible, Logo Perusahaan, Full Lokalisasi ID.
- `components/Header.jsx` : **UPDATED** - Glassmorphism UI & Project Switcher Premium.
- `app/projects/[projectId]/reports/pnl/balance-sheet/page.jsx` : UI & Print Engine Neraca Proyek (3 Kolom + Executive Summary).
- `lib/services/balance-sheet.service.ts` : Service Layer perhitungan Neraca.
- `app/projects/[projectId]/reports/pnl/page.jsx` : Integrasi tombol navigasi ke Neraca & Audit Trail (Soft Delete).
- `components/finances/CashFlowStatementView.tsx` : Standarisasi Kop Surat (Logo) & Garis TTD.
- `lib/services/*` : Service Layer (PO, Subcon, Termin, Inventory, dll).

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V35-A)
- **EVM S-Curve (Proporsional)**:
  - Menghitung Planned Value (PV) harian berbasis working days.
  - Garis EV & AC di-plot secara proporsional terhadap PV (mengikuti bentuk kurva S) dan dipotong tepat di tanggal hari ini (cut-off date).
  - KPI SPI, CPI, dan Progres Berbobot sinkron 100% dengan titik terakhir grafik.
- **Project Balance Sheet (Neraca Proyek)**:
  - Menjembatani P&L (Akrual) dan Cash Flow (Kas).
  - **3 Kolom Perbandingan**: Saldo Awal, Mutasi Periode, Saldo Akhir.
  - **Balance Guard**: Sistem memblokir cetak PDF jika Total Aset ≠ Total Liabilitas + Ekuitas.
  - **Zero Suppression**: Semua akun standar ditampilkan (meski Rp 0) untuk transparansi auditor.
- **Strict Accrual P&L (PSAK 115)**: Cost-to-Cost murni, Anti Laba Semu, CALK Rekonsiliasi.
- **Cash Flow (PSAK 207)**: Direct Method dengan pemisahan Operasi, Investasi, dan Pendanaan.
- **Audit Trail (Soft Delete)**: Snapshot laporan dapat dihapus dari UI, tetapi data asli tetap di database (`is_deleted = true`).

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal.
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at` / `is_deleted`).
3. **Print Engine (PDF) - PALING KRUSIAL**:
   - NO TAILWIND IN PDF: Wajib Inline Style / Pure CSS.
   - NO FLEXBOX/GRID IN PDF: Wajib `<table>` murni (termasuk untuk layout Kop Surat & Logo).
   - ANTI PAGE-BREAK: Gunakan `margin-top: auto;` pada kontainer bawah (TTD/Footer) di dalam Flexbox pembungkus A4 agar tidak menabrak tabel.
   - LOGO LIMIT: `max-height: 85px; max-width: 200px; object-fit: contain;`.
   - Wajib update RLS setiap membuat tabel/bucket baru.

## 5. CURRENT STATE (V35-A - PRODUCTION READY)
- **Material Management SELESAI**: Requirement Plan, Inventory, Purchase Order (GRN), Vendor, Laporan Premium.
- **Financial & P&L Engine SELESAI**: Dashboard Health, Aging AR/AP, Enterprise P&L Print Engine (Strict Accrual PSAK 115), Laporan Arus Kas (PSAK 207), Neraca Proyek (Balance), Snapshot History (Soft Delete).
- **SOP System SELESAI**: Halaman Interaktif `/sop`, Widget Dashboard, dan Contextual Alert.
- **Equipment & Fuel SELESAI (Tahap 1)**: Master Alat, Tangki Induk, Anti-Fraud Fuel Ratio, Smart Info Box.

## 6. NEXT STEPS (ROADMAP V35-B)
- A. **Penerapan "Gold Standard" UI**: Menerapkan tema Midnight Blue & tipografi premium ke halaman Tasks (WBS) dan Gantt Workspace.
- B. **Integrasi `daily_progress`**: Membuat fitur input harian agar pergerakan kurva S-Curve terekam historis per hari.
- C. **Modul Rekonsiliasi Bank**: Upload CSV Mutasi Bank vs Cash Flow (Auto-Matching).
- D. **Sempurnakan Modul Alat & BBM**: Melanjutkan Tahap 2 (Kontrak & Timesheet Minimum Charge).

---
**INSTRUCTION FOR AI:**
Anda adalah *Senior Tech Lead*. Jika diminta menulis kode, pastikan *Type-Safe*, sesuai *Folder Structure*, dan **100% PATUH** pada *Absolute Compliance Rules* (terutama PDF Engine dan UI Modal).