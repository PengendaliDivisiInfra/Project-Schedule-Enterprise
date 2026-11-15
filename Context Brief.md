# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V35-I)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V35-I)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), PWA (Service Worker, Dexie/IndexedDB), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)**, **PSAK 207 (Laporan Arus Kas)**, dan **Neraca Proyek (Project Balance Sheet)**. 
Fokus V35-I: **PWA & Offline Mode (Mobile-First Optimization)**. Sistem kini dilengkapi dengan *Service Worker* untuk *caching* App Shell, *IndexedDB* (Dexie) untuk antrean sinkronisasi data lapangan, dan *Local Cache* (localStorage) untuk membaca data dasbor/keuangan secara instan saat offline. Sistem Autentikasi (Middleware) juga diperkuat agar tidak terjadi *loop* atau error MIME saat berpindah halaman offline.

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/finances/page.jsx` : UI Keuangan (Ledger, Cost Control, Health, Aging). Terintegrasi Local Cache.
- `app/dashboard/page.jsx` : UI Dasbor Eksekutif. Terintegrasi Local Cache.
- `app/gantt/page.jsx` : UI Gantt Workspace. Terintegrasi Local Cache.
- `app/tasks/page.jsx` : UI Tabel WBS Premium. Terintegrasi Local Cache.
- `app/progress/page.jsx` : UI Progres Harian & Input Offline (Dexie).
- `app/login/page.jsx` : UI Login (Email & Google SSO). Menggunakan `<Suspense>`.
- `app/auth/callback/route.ts` : Handler OAuth Supabase (Next.js 14 App Router).
- `app/offline/page.jsx` : Halaman Fallback jika benar-benar tidak ada koneksi.
- `app/error.tsx` : Error Boundary Custom (Penangkap error navigasi).
- `components/BottomNav.jsx` : Navigasi Bawah khusus Mobile (PWA).
- `lib/utils/cache.js` : Helper `saveToCache` & `getFromCache` (localStorage).
- `lib/db/offline-db.ts` : Konfigurasi Dexie (IndexedDB) untuk antrean sinkronisasi.
- `lib/services/sync-service.ts` : Logic antrean sinkronisasi data offline ke Supabase.
- `middleware.js` : Middleware Auth & RBAC (Next.js 14).
- `next.config.js` : Konfigurasi PWA (`@ducanh2912/next-pwa`).
- `public/manifest.json` : Manifest PWA (Ikon, Tema, Start URL).

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V35-I)
- **PWA & Offline-First**: Menggunakan `@ducanh2912/next-pwa` dengan strategi `StaleWhileRevalidate` untuk aset statis dan RSC payload, serta `NetworkFirst` untuk halaman. Fallback ke `/offline` jika *request* gagal.
- **Local Data Cache**: Setiap halaman (`/finances`, `/dashboard`, `/tasks`) menyimpan data Supabase terakhir ke `localStorage` via `saveToCache`. Saat offline (`!navigator.onLine`), halaman langsung memuat dari `getFromCache` tanpa menunggu *timeout*.
- **Offline Input (Dexie)**: Form Progres Harian (dan modul lain di masa depan) disimpan ke IndexedDB saat offline. Saat koneksi kembali online, `sync-service.ts` mengirim antrean ke Supabase secara otomatis.
- **Auth & Middleware**: Middleware mengecualikan rute `/auth`, `/api`, dan file statis. Jika terjadi *rate limit* atau *offline*, Middleware memvalidasi keberadaan *cookie* auth agar tidak memaksa *logout*.
- **Database Schema Fix**: View `v_cost_control_wbs` telah diperbarui untuk menyertakan `project_id` dan menerapkan `security_invoker = true` untuk keamanan RLS.

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at` / `is_deleted`).
3. **Print Engine (PDF)**: NO TAILWIND, **NO FLEXBOX/GRID**, WAJIB `<table>` murni, ANTI PAGE-BREAK (Gunakan teknik *Absolute Footer* & *Wrapper*).
4. **Database**: Wajib update RLS setiap membuat tabel/bucket baru.
5. **RBAC**: Setiap tombol aksi baru (Edit, Delete, Approve, Void, Cetak) **WAJIB** dibungkus dengan hook `useRole`.
6. **Git Workflow**: DILARANG `git push` langsung ke `main`. Wajib menggunakan *Feature Branch* (`feat/nama-fitur`), uji di Vercel *Preview*, lalu buat *Pull Request* (PR) sebelum *Merge* ke `main`.

## 5. CURRENT STATE (V35-I - PRODUCTION READY)
- **Security & Multi-Tenancy**: SELESAI.
- **Financial & P&L Engine**: SELESAI.
- **Warehouse, Ledger & BBM Integration**: SELESAI (V35-F).
- **Manpower & Payroll Management**: SELESAI (V35-G).
- **Cash Flow Forecasting**: SELESAI (V35-H).
- **PWA & Offline Mode**: SELESAI (V35-I). Termasuk perbaikan Google SSO & Sinkronisasi Dexie.

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
- **G. PWA & Offline Mode**: ✅ SELESAI (V35-I).
- **H. Integrasi WhatsApp Bot**: Daily Report otomatis & input progres via WA. (Berikutnya)
- **I. OCR Auto-Read Nota**: Scan Nota/SJ.