# PROJECT HANDOFF DOCUMENT — PROJECT SCHEDULE ENTERPRISE (V36)

**Status Proyek:** Production Ready (V36 Enterprise Gold Standard)
**Terakhir Diperbarui:** 28 November 2026
**Stack & Infrastruktur:** Next.js 14.2.35 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL, RLS, Auth, MFA, Private Storage), PWA (`@ducanh2912/next-pwa` + Dexie v3), Vercel Production, Railway PDF Service.

---

## 1. RINGKASAN EKSEKUTIF

Seluruh **10 Pilar Cetak Biru Enterprise Premium & Standar Operasional Kontraktor** telah terimplementasi penuh dari lapisan database PostgreSQL (trigger, view, RPC `SELECT ... FOR UPDATE`, RLS) hingga antarmuka web & PWA mobile:

* **Gelombang A (Keamanan & Tata Kelola):** Table-wide RLS, Hybrid RBAC (`global_role` + `project_role`), Immutable Audit Log (`INSERT ONLY` + IP/User-Agent), Signed URL 10 menit, dan 2FA TOTP Approver.
* **Gelombang B (Anggaran & Persetujuan):** 3 Lapisan Anggaran (`Available`/`Committed`/`Actual`), Hard-Stop `SELECT ... FOR UPDATE`, dan Dynamic Approval Matrix (`approval_rules`).
* **Gelombang C (Rantai Pasok & Gudang):** Purchase Request (PR), Vendor Invoice + Three-Way Matching + GPS/Timestamp Surat Jalan GRN, Multi-Gudang (Pusat vs Site), Material Transfer Request (realokasi biaya antar-proyek), dan Stock Opname.
* **Gelombang D (Arus Kas & Perubahan Kontrak):** Ring-Fenced Cashflow Guard (UI + RPC database), Bank Garansi & Jatuh Tempo Retensi, BAKP Auto-Progress Billing, Penguncian RAB Baseline v0 & Addendum CCO v1..n, serta Unapproved Work Alert.
* **Gelombang E (Vendor & Aset Lapangan):** Centralized Vendor Master, Blacklist & NPWP/PKP/Legal Expiry Trigger (memblokir PO/SPK otomatis), Performance Scorecard, Daily Rental Cost Accrual & Expiry Alert, serta Asset Custody Transfer + Stiker QR Code offline.
* **Gelombang F (HSE & SDM Lapangan):** HSE Compliance Gate (JSA/Work Permit mengunci progres WBS risiko tinggi), Offline-First Photo Queue (Dexie v3) dengan kompresi Canvas otomatis, Anti-Ghost Worker NIK Guard lintas proyek, dan penautan upah payroll ke `wbs_code` RAB.
* **Hardening & Operational Polish:** Penegakan Ring-Fenced Cashflow di dalam `rpc_submit_budgeted_cashflow`, penghapusan seluruh UUID/profil statis, persetujuan Ledger via `processTieredApproval` + 2FA, auto-scoping `useRole()`, kebijakan kamera `camera=(self)`, isolasi query multi-proyek 100%, kontrol proteksi proyek di `/settings/project`, serta pembaruan navigasi Sidebar/BottomNav.

---

## 2. QUALITY GATE & DATABASE

* **Migrasi SQL Supabase:** 13 file migrasi idempoten (`supabase/migrations/20261127_01_...sql` s.d. `20261128_13_...sql`) sudah tereksekusi bersih di Supabase Production.
* **Automated Tests:** **11 Jest Test Suites (43/43 unit tests PASS)**:
  1. `hybrid-rbac.test.js`
  2. `budget-approval-engine.test.js`
  3. `supply-chain-3way.test.js`
  4. `contractor-controls.test.js`
  5. `vendor-equipment-controls.test.js`
  6. `hse-workforce-controls.test.js`
  7. `cpm-engine.test.js`
  8. `evm-engine.test.js`
  9. `sak-calculator.test.js`
  10. `overtime-pp35.test.js`
  11. `terbilang.test.js`
* **API Routes:** `8/8` endpoint API terverifikasi autentikasi + otorisasi proyek; `0` dialog bawaan browser (`alert`/`confirm`/`prompt`).

---

## 3. OPERASIONAL & PEMELIHARAAN

1. **Pengaturan Proteksi per Proyek:** Admin/Finance Manager/Owner dapat mengatur `budget_hard_stop`, `ring_fenced_cashflow`, dan `hq_dropping_limit` langsung melalui **`/settings/project`** (tercatat otomatis ke Audit Log).
2. **Penguncian Baseline Kontrak:** Sebelum memulai pekerjaan tambah/kurang pada proyek baru, PM/Owner disarankan mengunci **RAB Baseline (v0)** di menu **`/change-orders`**.
3. **Verifikasi Sebelum Rilis:** Jalankan `.\PreFlight-Check.ps1` di root repositori sebelum membuat Pull Request baru.
