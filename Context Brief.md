# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V35-H)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V35-H)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)**, **PSAK 207 (Laporan Arus Kas)**, dan **Neraca Proyek (Project Balance Sheet)**. 
Fokus V35-H: **Financial & Cost Control (Cash Flow Forecasting)** dan penyempurnaan **Manpower & Payroll (V35-G)**. Sistem kini mampu memproyeksikan arus kas 1-3 bulan ke depan berdasarkan Invoice Outstanding dan Hutang Subkon, terintegrasi penuh dengan *Enterprise Print Engine* (A4 Landscape).

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/finances/page.jsx` : UI Utama Keuangan (Ledger, Forecast, Aging, Statement).
- `app/manpower/page.tsx` : UI Manajemen Tenaga Kerja & Payroll.
- `app/projects/page.jsx` : UI Daftar Proyek.
- `app/projects/new/page.jsx` : Wizard Setup Proyek Baru.
- `app/settings/team/page.jsx` : Manajemen Tim Proyek (Custom Modal).
- `app/tasks/page.jsx` : UI Tabel WBS Premium.
- `app/materials/page.jsx` : UI Manajemen Material, PO, Vendor, dan SOP.
- `components/payroll/EmployeeManager.tsx` : UI Master Karyawan & Sistem All-In.
- `components/inventory/InventoryManager.tsx` : UI Buku Besar & Stok Fisik.
- `components/finances/CashFlowForecastView.tsx` : UI Proyeksi Kas & Cetak PDF.
- `lib/services/payroll-service.ts` : Logic Gaji (PP 35/2021), Auto-Cost, Void.
- `lib/services/inventory-service.ts` : Logic Ledger, Auto-Cost, Void, dan BBM.
- `lib/services/cashflow-forecast.service.ts` : Logic Proyeksi Kas (Inflow/Outflow).
- `hooks/useRole.ts` : Logika Otorisasi (RBAC UI & Fallback ke `Guest`).

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V35-H)
- **Multi-Tenancy & RLS**: Semua tabel dilindungi RLS. User hanya bisa mengakses data proyek di mana ia terdaftar.
- **RBAC UI**: Tombol krusial (Void, Koreksi, Cetak) dibungkus dengan `can('EDIT_INVENTORY')` atau `useRole`.
- **Cash Flow Forecasting**: Menarik data `client_invoices` (Unpaid) dan `subcontractor_payments` (Pending/Approved) untuk memproyeksikan kas 3 bulan ke depan.
- **Payroll to Financials**: Status `Approved` insert ke `actual_costs`; Status `Paid` insert ke `cash_flows`. Void menerapkan *Soft Delete*.
- **Print Engine Rules**: Menggunakan `@page { size: A4 landscape; margin: 15mm 20mm; }`, **WAJIB `<table>` murni (NO FLEXBOX/GRID)**, posisi TTD menggunakan *Absolute Footer* (Anti *blank page* & *overlap*).

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at` / `is_deleted`).
3. **Print Engine (PDF)**: NO TAILWIND, **NO FLEXBOX/GRID**, WAJIB `<table>` murni, ANTI PAGE-BREAK (Gunakan teknik *Absolute Footer* & *Wrapper*).
4. **Database**: Wajib update RLS setiap membuat tabel/bucket baru.
5. **RBAC**: Setiap tombol aksi baru (Edit, Delete, Approve, Void, Cetak) **WAJIB** dibungkus dengan hook `useRole`.
6. **Git Workflow**: DILARANG `git push` langsung ke `main`. Wajib menggunakan *Feature Branch* (`feat/nama-fitur`), uji di Vercel *Preview*, lalu buat *Pull Request* (PR) sebelum *Merge* ke `main`.

## 5. CURRENT STATE (V35-H - PRODUCTION READY)
- **Security & Multi-Tenancy**: SELESAI.
- **Warehouse, Ledger & BBM Integration**: SELESAI (V35-F).
- **Manpower & Payroll Management**: SELESAI (V35-G).
- **Cash Flow Forecasting**: SELESAI (V35-H - Dashboard & PDF A4 Landscape).
- **Financial & P&L Engine**: SELESAI.

## 6. NEXT STEPS (ROADMAP V35-I ke atas)

**FASE 1: Financial & Cost Control (Sisa)**
- **A. Variation Order (CCO)**: Pencatatan Addendum, update Kontrak, RAP, P&L.
- **B. Rekonsiliasi Bank**: Upload CSV Mutasi Bank (BCA/Mandiri) vs Cash Flow (Auto-Matching).

**FASE 2: Operations & Field**
- **C. Multi-Warehouse**: Stock Transfer antar Gudang Site.
- **D. Document Control & RFI**: Integrasi Supabase Storage untuk Shop Drawing/Addendum.

**FASE 3: Quality & Executive**
- **E. Upgrade Modul QHSE**: Digital checklist ITP, Defect Tracking, Safety Report.
- **F. Executive Multi-Project Dashboard**: Dasbor Owner untuk agregasi SPI, CPI, Margin.

**FASE 4: Advanced Tech**
- **G. PWA & Offline Mode**: Optimasi Mobile-First & IndexedDB.
- **H. Integrasi WhatsApp Bot**: Daily Report otomatis & input progres via WA.
- **I. OCR Auto-Read Nota**: Scan Nota/SJ.