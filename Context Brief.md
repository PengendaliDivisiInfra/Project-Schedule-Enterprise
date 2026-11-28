# ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF — PROJECT SCHEDULE ENTERPRISE (V36)

**Subject:** System Architecture & Developer Onboarding Brief (V36 Enterprise)
**Updated:** 28 November 2026
**Tech Stack:** Next.js 14.2.35 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS + Storage + TOTP MFA), PWA (`@ducanh2912/next-pwa` + Dexie v3), Jest 29, Vercel, Railway PDF Service.

---

## 1. ARCHITECTURAL INVARIANTS (WAJIB DIPATUHI)

1. **Multi-Tenant Isolation:** Setiap query data proyek wajib terikat `project_id` (serta dilindungi RLS PostgreSQL melalui `public.has_project_access(project_id)` dan `public.has_project_write_access(project_id)`).
2. **Soft-Void & Auditability:** Transaksi keuangan, PO, SPK, payroll, dan log tidak boleh di-*hard-delete*; gunakan mekanisme soft-void (`voided_at`, `is_deleted`) dan catat ke `audit_logs` (`INSERT ONLY`) via `recordAuditEvent()`.
3. **Pessimistic Concurrency Locking:** Pengajuan kas keluar, PO, penguncian RAB Baseline, penandatanganan CCO, dan serah terima aset wajib diproses melalui RPC PostgreSQL dengan `SELECT ... FOR UPDATE`.
4. **Private Storage Policy:** Seluruh dokumen sensitif (KTP, bukti nota, Surat Jalan GRN, Bank Garansi, JSA/Work Permit, Addendum) disimpan di bucket privat (`evidence`, `ktp_documents`, `project-vault`) dan hanya diakses lewat **Signed URL 10 menit** (`lib/utils/secure-storage.ts`). Bucket publik hanya digunakan untuk logo perusahaan (`project-assets`).
5. **Zero Native Browser Dialogs:** Dilarang menggunakan `alert()`, `confirm()`, atau `prompt()`. Gunakan `ConfirmModal` (`components/ui/ConfirmModal.tsx`) dan event `app-toast`.
6. **Windows PowerShell UTF-8 (No BOM):** Hindari `Set-Content -Encoding UTF8` pada Windows PowerShell 5.1 untuk file `.ts`/`.tsx`; gunakan `UTF8Encoding($false)` dan verifikasi via `.\PreFlight-Check.ps1`.

---

## 2. KEY MODULES & FILE MAP

### Core App Routes (`app/`)
* `/dashboard`, `/gantt`, `/tasks`, `/s-curve` — Penjadwalan CPM, EVM, dan Kurva-S.
* `/progress` — Progres harian offline-first + kompresi foto otomatis (`image-compressor.ts`) + HSE Gate check.
* `/qhse` — QA/QC, HSE Log, dan **JSA & Work Permit Compliance Gate** (`HsePermitGateManager.tsx`).
* `/finances` — Ledger (persetujuan berjenjang + 2FA), 3-Layer Cost Control, Ring-Fenced Cashflow Alert, Forecasting, dan Laporan Arus Kas PSAK 207.
* `/projects/[projectId]/termin` — Termin klien, BAKP Auto-Progress Billing, Pencairan Retensi, dan **Bank Garansi** (`BankGuaranteeManager.tsx`).
* `/change-orders` — Penguncian RAB Baseline v0, Contract Change Order (CCO) v1..n, dan Unapproved Variation Work Alert.
* `/materials` — Requirement Plan, Stok Gudang, PR, PO, Vendor Invoice & 3-Way Match (GRN GPS/Foto), Multi-Gudang & Transfer, Master Vendor, dan Rekap Laporan.
* `/vendors/compliance` — Centralized Vendor Master, Blacklist & NPWP/PKP Guard, dan Performance Scorecard.
* `/projects/[projectId]/equipment/*` — Kontrak Sewa (+ Daily Accrual & Expiry Alert), Unit, **Custody & QR Aset** (`/custody`), BBM, Timesheet, dan BAR.
* `/manpower` — Karyawan, Absensi (Anti-Ghost Worker NIK Guard lintas proyek), dan Payroll (PP 35/2021 + WBS Cost Link).
* `/approvals`, `/settings/approval-matrix`, `/settings/security`, `/settings/project`, `/logs` — Persetujuan berjenjang, Matriks Approval, 2FA TOTP, Proteksi Keuangan Proyek, dan Log Audit.

### Core Engines & Services (`lib/`)
* `lib/config/permissions.ts` & `lib/hooks/useRole.ts` — Hybrid RBAC (otomatis *fallback* ke `activeProjectId` dari `ProjectContext`).
* `lib/utils/budget-control.ts` & `lib/services/budget-control.service.ts` — 3-Layer Budget & Approval Matrix Engine.
* `lib/utils/supply-chain.ts` & `lib/services/supply-chain.service.ts` — PR, 3-Way Match, Multi-Gudang & Opname.
* `lib/utils/contractor-controls.ts` & `lib/services/contractor-controls.service.ts` — Ring-Fenced Cashflow, Bank Garansi, BAKP & CCO.
* `lib/utils/vendor-equipment-controls.ts`, `lib/utils/qr-svg.ts`, `lib/services/vendor-compliance.service.ts`, `lib/services/asset-custody.service.ts` — Vendor Blacklist/Scorecard, Rental Accrual & ISO QR Generator.
* `lib/utils/hse-workforce-controls.ts`, `lib/utils/image-compressor.ts`, `lib/db/offline-db.ts`, `lib/services/sync-service.ts`, `lib/services/hse-workforce.service.ts` — HSE Gate, Offline Photo Sync (Dexie v3) & Anti-Ghost Workers.
