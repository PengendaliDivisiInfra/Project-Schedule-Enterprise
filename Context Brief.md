# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V35-G)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V35-G)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)**, **PSAK 207 (Laporan Arus Kas)**, dan **Neraca Proyek (Project Balance Sheet)**. 
Fokus V35-G: **Manajemen Tenaga Kerja & Payroll (Manpower)**. Sistem kini mendukung perhitungan gaji sesuai regulasi PP 35/2021, sistem *All-In*, integrasi otomatis ke HPP Upah di Laba Rugi (P&L) dan Arus Kas, serta dilengkapi dengan *Print Engine* standar HR (Landscape A4).

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/projects/page.jsx` : UI Daftar Proyek.
- `app/projects/new/page.jsx` : Wizard Setup Proyek Baru.
- `app/manpower/page.tsx` : UI Manajemen Tenaga Kerja & Payroll.
- `app/manpower/print/[payrollId]/page.tsx` : Print Engine Slip Gaji & Laporan (Landscape).
- `app/settings/team/page.jsx` : Manajemen Tim Proyek (Custom Modal).
- `app/tasks/page.jsx` : UI Tabel WBS Premium.
- `app/materials/page.jsx` : UI Manajemen Material, PO, Vendor, dan SOP.
- `components/payroll/EmployeeManager.tsx` : UI Master Karyawan & Sistem All-In.
- `components/payroll/AttendanceManager.tsx` : UI Absensi Harian (Harian/Bulanan).
- `components/payroll/PayrollManager.tsx` : UI Generate & Riwayat Payroll.
- `components/inventory/InventoryManager.tsx` : UI Buku Besar & Stok Fisik.
- `lib/services/payroll-service.ts` : Logic Gaji (PP 35/2021), Auto-Cost, Void.
- `lib/services/inventory-service.ts` : Logic Ledger, Auto-Cost, Void, dan BBM.
- `hooks/useRole.ts` : Logika Otorisasi (RBAC UI & Fallback ke `Guest`).
- `middleware.js` : Route Protection (Auth level).

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V35-G)
- **Multi-Tenancy & RLS**: Semua tabel dilindungi RLS. User hanya bisa mengakses data proyek di mana ia terdaftar.
- **RBAC UI**: Tombol krusial (Void, Koreksi) dibungkus dengan `can('EDIT_INVENTORY')` atau `can('MANAGE_COA')`.
- **Payroll Logic**: Mendukung Perhitungan Reguler (Prorata 21 hari, Lembur 1/173) dan *All-In* (Lump Sum). Absensi `Sick`/`Leave` tetap dibayar gaji pokoknya, tapi memotong Uang Makan. Absensi `Absent` (Mangkir) memotong Gaji Pokok & Uang Makan.
- **Payroll to Financials**: Saat status payroll `Approved`, sistem otomatis insert ke `actual_costs` (HPP Labor). Saat `Paid`, sistem insert ke `cash_flows` (Kas Keluar). Void Payroll menerapkan *Soft Delete* di ketiga tabel tersebut.
- **Print Engine**: Menggunakan CSS `@page A4 landscape`, layout *Flexbox* yang dikunci, Watermark VOID, Custom TTD, dan format Terbilang otomatis.

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at` / `is_deleted`).
3. **Print Engine (PDF)**: NO TAILWIND, NO FLEXBOX/GRID, WAJIB `<table>` murni, ANTI PAGE-BREAK (Gunakan teknik *Absolute Footer* & *Wrapper*).
4. **Database**: Wajib update RLS setiap membuat tabel/bucket baru.
5. **RBAC (Role-Based Access Control)**: Setiap penambahan fitur/tombol aksi baru (Edit, Delete, Approve, Void) **WAJIB** dibungkus dengan hook `useRole`. Dilarang membiarkan tombol krusial terekspos ke role `Guest` atau `Viewer`.

## 5. CURRENT STATE (V35-G - PRODUCTION READY)
- **Security & Multi-Tenancy**: SELESAI.
- **Setup Proyek Baru (Wizard)**: SELESAI.
- **Warehouse, Ledger & BBM Integration**: SELESAI.
- **Manpower & Payroll Management**: SELESAI (Termasuk PP 35/2021, All-In, Auto-Cost ke P&L, Enterprise Print Engine).
- **Financial & P&L Engine**: SELESAI.
- **UI Gold Standard**: SELESAI.

## 6. NEXT STEPS (ROADMAP V35-H ke atas)

**FASE 1: Financial & Cost Control (Prioritas Utama)**
- **A. Variation Order (CCO)**: Pencatatan Addendum, update Kontrak, RAP, P&L.
- **B. Cash Flow Forecasting**: Proyeksi Kas berdasarkan komitmen PO, sisa termin, dan jadwal payroll.
- **C. Rekonsiliasi Bank**: Upload CSV Mutasi Bank (BCA/Mandiri) vs Cash Flow (Auto-Matching).

**FASE 2: Operations & Field (Sisa)**
- **D. Multi-Warehouse**: Pemisahan stok antar Gudang Site (Gudang Pusat & Gudang Spillway) beserta fitur Stock Transfer.
- **E. Document Control & RFI**: Integrasi Supabase Storage untuk Shop Drawing/Addendum (Versioning, Link to WBS, RFI).

**FASE 3: Quality & Executive**
- **F. Upgrade Modul QHSE**: Digital checklist ITP, *Defect Tracking* (Punch List) dengan foto, dan *Safety Report* (K3).
- **G. Executive Multi-Project Dashboard**: Dasbor Owner untuk agregasi SPI, CPI, dan Margin dari seluruh proyek.

**FASE 4: Advanced Tech**
- **H. PWA & Offline Mode**: Optimasi Mobile-First untuk Site Engineer.
- **I. Integrasi WhatsApp Bot**: *Daily Report* otomatis & input progres via WA.
- **J. OCR Auto-Read Nota**: Scan Surat Jalan/Nota belanja.
- **K. Sinkronisasi API Pajak / e-Faktur (Opsional)**.