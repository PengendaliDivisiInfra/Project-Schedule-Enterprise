# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V35-E)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V35-E)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)**, **PSAK 207 (Laporan Arus Kas)**, dan **Neraca Proyek (Project Balance Sheet)**. 
Fokus V35-E: **Audit Multi-Tenancy (Isolasi Data 100%)** dan **Setup Proyek Baru (Wizard)**. Sistem kini menjamin keamanan data antar proyek, sekaligus menyederhanakan proses inisialisasi proyek baru oleh Admin.

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/projects/page.jsx` : UI Daftar Proyek (Manajemen Proyek).
- `app/projects/new/page.jsx` : **Wizard Setup Proyek Baru (V35-E)**.
- `app/settings/team/page.jsx` : Manajemen Tim Proyek (Custom Modal, Zero `confirm()`).
- `app/tasks/page.jsx` : UI Tabel WBS Premium (Sticky Columns, Tipografi Tabular).
- `app/gantt/page.jsx` & `components/AdvancedGantt.jsx` : UI Gantt Workspace Premium.
- `app/progress/page.jsx` : Laporan Historis Harian.
- `app/api/analytics/scurve/route.js` : Proporsional EV mapping & Cut-off Date.
- `app/dashboard/page.jsx` : Dasbor Eksekutif (EVM KPI, S-Curve).
- `app/projects/[projectId]/equipment/...` : Modul Alat & BBM (Phase 2).
- `components/ToastListener.jsx` : **Global Toast Notification (Pengganti `alert()`)**.
- `hooks/useRole.ts` : Logika Otorisasi (Fallback ke `Guest`).
- `store/useProjectStore.js` : Zustand Store (Sync & Custom Event).
- `middleware.js` : Route Protection (Auth level).

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V35-E)
- **Multi-Tenancy & RLS**: Semua tabel (`projects`, `wbs_tasks`, `cash_flows`, `equipment_*`, dll) telah dilindungi RLS menggunakan fungsi `is_project_member()` dan `has_project_role()`. User hanya bisa mengakses data proyek di mana ia terdaftar.
- **Role Fallback Security**: `useRole.ts` telah diperbaiki. User yang tidak memiliki role eksplisit akan otomatis menjadi `Guest` (Diblokir total), bukan lagi `Site Admin`.
- **Setup Proyek Wizard**: Wizard 3 langkah (`/projects/new`) untuk inisialisasi proyek. Otomatis mendaftarkan pembuat proyek sebagai `Project Manager` di tabel `project_members`.
- **Virtual Fuel Tank & BAR**: Tetap berjalan (Sisa BBM minus sebagai indikator, PDF Tripartit, Auto-Journaling).
- **Global Toast**: Seluruh notifikasi UI menggunakan Custom Event (`app-toast`) yang ditangkap oleh `ToastListener`.

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at` / `is_deleted`).
3. **Print Engine (PDF)**: NO TAILWIND, NO FLEXBOX/GRID, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. **Database**: Wajib update RLS setiap membuat tabel/bucket baru.

## 5. CURRENT STATE (V35-E - PRODUCTION READY)
- **Security & Multi-Tenancy**: SELESAI (RLS, Guest Fallback, Route Protection).
- **Setup Proyek Baru (Wizard)**: SELESAI.
- **Equipment & Fuel Management**: SELESAI.
- **Financial & P&L Engine**: SELESAI.
- **UI Gold Standard**: SELESAI (Custom Modals, Toasts, Sticky Columns).

## 6. NEXT STEPS (ROADMAP V35-F ke atas)
- **A. Modul Rekonsiliasi Bank**: Upload CSV Mutasi Bank (BCA/Mandiri) vs Cash Flow (Auto-Matching).
- **B. Modul Document Control & RFI**: Upload Shop Drawing/Addendum dengan Versioning, link ke WBS, dan fitur Request for Information.
- **C. Upgrade Modul QHSE (Punch List & Inspection)**: Digital checklist inspeksi (ITP), Defect Tracking (Punch List), dan Safety Report (K3).
- **D. Modul Manajemen Gudang (Warehouse)**: Stock In/Out material, Auto-Cost ke WBS, dan Stock Opname.
- **E. PWA & Mobile-First View**: Optimasi UI untuk Site Engineer di lapangan (HP/Tablet) dengan fitur Offline Mode.
- **F. Executive Multi-Project Dashboard**: Dasbor khusus Owner untuk melihat agregasi SPI, CPI, dan Margin seluruh proyek.
- **G. Sinkronisasi API Pajak / e-Faktur (Opsional)**.