# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V35-F)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V35-F)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)**, **PSAK 207 (Laporan Arus Kas)**, dan **Neraca Proyek (Project Balance Sheet)**. 
Fokus V35-F: **Manajemen Gudang (Warehouse)**, **Buku Besar Mutasi (Ledger)**, dan **Integrasi BBM**. Sistem kini menjamin pergerakan material tercatat secara akrual dan terintegrasi ke Laporan Laba Rugi (P&L) serta Arus Kas.

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/projects/page.jsx` : UI Daftar Proyek.
- `app/projects/new/page.jsx` : Wizard Setup Proyek Baru.
- `app/settings/team/page.jsx` : Manajemen Tim Proyek (Custom Modal).
- `app/tasks/page.jsx` : UI Tabel WBS Premium.
- `app/gantt/page.jsx` & `components/AdvancedGantt.jsx` : UI Gantt Workspace.
- `app/progress/page.jsx` : Laporan Historis Harian.
- `app/api/analytics/scurve/route.js` : Proporsional EV mapping.
- `app/dashboard/page.jsx` : Dasbor Eksekutif (EVM KPI, S-Curve).
- `app/projects/[projectId]/equipment/...` : Modul Alat & BBM.
- `app/materials/page.jsx` : UI Manajemen Material, PO, Vendor, dan SOP.
- `components/inventory/InventoryManager.tsx` : UI Buku Besar & Stok Fisik.
- `components/equipment/FuelReceiptModal.tsx` : UI Penerimaan BBM (Segel & Nopol).
- `lib/services/inventory-service.ts` : Logic Ledger, Auto-Cost, Void, dan BBM.
- `components/ToastListener.jsx` : Global Toast Notification.
- `hooks/useRole.ts` : Logika Otorisasi (RBAC UI & Fallback ke `Guest`).
- `store/useProjectStore.js` : Zustand Store.
- `middleware.js` : Route Protection (Auth level).

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V35-F)
- **Multi-Tenancy & RLS**: Semua tabel dilindungi RLS. User hanya bisa mengakses data proyek di mana ia terdaftar.
- **RBAC UI**: Tombol krusial (Void, Koreksi) pada komponen `InventoryManager.tsx` dibungkus dengan `can('EDIT_INVENTORY')`.
- **Ledger & Auto-Cost**: Tabel `inventory_transactions` mencatat IN/OUT. Saat OUT, otomatis insert ke `actual_costs` (HPP jika task_id WBS, OPEX jika null).
- **BBM Integration**: `FuelReceiptModal` menyimpan data ke `fuel_receipts` lalu memanggil `recordTransaction` (IN). Pengisian BBM memanggil `recordFuelDispensing` (OUT) dengan `equipment_id`.
- **Virtual Fuel Tank & BAR**: Tetap berjalan (Sisa BBM minus sebagai indikator, PDF Tripartit, Auto-Journaling).

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at` / `is_deleted`).
3. **Print Engine (PDF)**: NO TAILWIND, NO FLEXBOX/GRID, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. **Database**: Wajib update RLS setiap membuat tabel/bucket baru.
5. **RBAC (Role-Based Access Control)**: Setiap penambahan fitur/tombol aksi baru (Edit, Delete, Approve, Void) **WAJIB** dibungkus dengan hook `useRole` (contoh: `can('EDIT_INVENTORY')`). Dilarang membiarkan tombol krusial terekspos ke role `Guest` atau `Viewer`.

## 5. CURRENT STATE (V35-F - PRODUCTION READY)
- **Security & Multi-Tenancy**: SELESAI (RLS, Guest Fallback, Route Protection).
- **Setup Proyek Baru (Wizard)**: SELESAI.
- **Equipment & Fuel Management**: SELESAI.
- **Warehouse, Ledger & BBM Integration**: SELESAI.
- **Financial & P&L Engine**: SELESAI.
- **UI Gold Standard**: SELESAI (Custom Modals, Toasts, Sticky Columns, RBAC).

## 6. NEXT STEPS (ROADMAP V35-G ke atas)

**FASE 1: Financial & Cost Control**
- **A. Variation Order (CCO)**: Pencatatan Addendum, update Kontrak, RAP, P&L.
- **B. Cash Flow Forecasting**: Proyeksi Kas berdasarkan komitmen PO dan Termin.
- **C. Rekonsiliasi Bank**: Upload CSV Mutasi Bank (Auto-Matching).

**FASE 2: Operations & Field**
- **D. Manpower & Payroll**: Absensi harian & Auto-Payroll (HPP Upah).
- **E. Multi-Warehouse**: Stock Transfer antar Gudang Site.
- **F. Document Control & RFI**: Shop Drawing Versioning, Link WBS, RFI.

**FASE 3: Quality & Executive**
- **G. QHSE Punch List**: ITP, Defect Tracking (Foto), Safety Report (K3).
- **H. Executive Multi-Project Dashboard**: Agregasi SPI, CPI, Margin semua proyek.

**FASE 4: Advanced Tech**
- **I. PWA & Offline Mode**: Optimasi Mobile & IndexedDB untuk input lapangan.
- **J. Integrasi WhatsApp Bot**: Daily Report & Input Progres via WA.
- **K. OCR Auto-Read Nota**: Scan Nota/SJ untuk input Logistik.
- **L. Sinkronisasi API Pajak / e-Faktur (Opsional)**.