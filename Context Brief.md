# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V35-C)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V35-C)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar akuntansi **PSAK 115 (Pendapatan Kontrak)**, **PSAK 207 (Laporan Arus Kas)**, dan **Neraca Proyek (Project Balance Sheet)**. 
Fokus V35-C: **Penyempurnaan Modul Alat & BBM (Tahap 2)**, integrasi *Virtual Fuel Tank*, logika *Minimum Charge/Overtime*, dan *Berita Acara Rekonsiliasi (BAR)* dengan Engine PDF Premium.

## 2. DIRECTORY STRUCTURE (VERIFIED & EXPANDED)
- `app/tasks/page.jsx` : UI Tabel WBS Premium (Sticky Columns, Tipografi Tabular).
- `app/gantt/page.jsx` & `components/AdvancedGantt.jsx` : UI Gantt Workspace Premium.
- `app/progress/page.jsx` : Laporan Historis Harian.
- `app/api/analytics/scurve/route.js` : Proporsional EV mapping & Cut-off Date.
- `app/dashboard/page.jsx` : Dasbor Eksekutif (EVM KPI, S-Curve).
- `app/projects/[projectId]/equipment/contracts/page.jsx` : Manajemen PO Sewa, Tarif, Kuota, dan Aturan OT.
- `app/projects/[projectId]/equipment/units/page.jsx` : Master Unit & Pelacakan HM/BBM Virtual.
- `app/projects/[projectId]/equipment/fuel/page.jsx` : Input BBM, Deteksi Anomali, & Tooltip Defisit.
- `app/projects/[projectId]/equipment/timesheet/page.jsx` : Input Jam Kerja, Split Reguler/OT, & Approval.
- `app/projects/[projectId]/equipment/bar/page.jsx` : Generate Rekonsiliasi (BAR) & Export PDF.
- `lib/services/equipment.service.ts` : Service Layer terpusat (Kalkulasi Virtual Tank, BAR, dll).
- `lib/services/balance-sheet.service.ts` : Service Layer perhitungan Neraca.
- `lib/scheduler.js` : Mesin CPM & kalkulasi hari kerja.

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V35-C)
- **Virtual Fuel Tank**: Sisa BBM dihitung otomatis (Running Balance) berdasarkan `initial_fuel` + Refuel - Pemakaian (Timesheet). Angka minus dibiarkan sebagai *Red Flag* audit.
- **Approval Workflow**: Data Timesheet berstatus `Draft` tidak memotong kuota. Hanya status `Approved` yang masuk ke kalkulasi BAR dan saldo kontrak.
- **BAR (Berita Acara Rekonsiliasi)**: Menggabungkan tagihan Alat, Overtime, dan potongan BBM (Auto-Deduction) ke dalam PDF 1 halaman dengan tanda tangan Tripartit.
- **EVM Mapping**: Garis EV & AC di-plot secara proporsional dan dipotong tepat di tanggal hari ini.
- **Project Balance Sheet**: 3 Kolom (Awal, Mutasi, Akhir), Balance Guard, Zero Suppression.
- **Strict Accrual P&L (PSAK 115)**: Cost-to-Cost murni, CALK Rekonsiliasi.
- **Cash Flow (PSAK 207)**: Direct Method dengan pemisahan Operasi, Investasi, dan Pendanaan.

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal (React State).
2. **Keuangan & Data**: DILARANG Hard Delete pada data finansial dan inventaris. Wajib Soft Delete (VOID / `voided_at` / `is_deleted`).
3. **Print Engine (PDF) - PALING KRUSIAL**:
   - NO TAILWIND IN PDF: Wajib Inline Style / Pure CSS.
   - NO FLEXBOX/GRID IN PDF: Wajib `<table>` murni (termasuk untuk layout Kop Surat & Logo).
   - ANTI PAGE-BREAK: Gunakan `margin-top: auto;` pada kontainer bawah (TTD/Footer).
   - LOGO LIMIT: `max-height: 85px; max-width: 200px; object-fit: contain;`.
   - Wajib update RLS setiap membuat tabel/bucket baru.

## 5. CURRENT STATE (V35-C - PRODUCTION READY)
- **Material Management SELESAI**.
- **Financial & P&L Engine SELESAI**.
- **SOP System SELESAI**.
- **Project Scheduling SELESAI**.
- **Equipment & Fuel Management (Phase 2) SELESAI**: Termasuk Kontrak, Virtual Tank, BAR, PDF Engine, & Audit Anomali.

## 6. NEXT STEPS (ROADMAP V35-D)
- A. **Modul Rekonsiliasi Bank**: Upload CSV Mutasi Bank vs Cash Flow (Auto-Matching).
- B. **Fitur "Setup Proyek Baru" (Wizard)**: Membuat panduan interaktif inisialisasi proyek baru.
- C. **Sinkronisasi API Pajak / e-Faktur (Opsional)**.