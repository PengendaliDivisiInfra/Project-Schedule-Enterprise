# Project Schedule Enterprise (InfraControl PRO — V36 Enterprise)

Platform **Enterprise Construction ERP, Project Controls & Multi-PM Governance** berbasis **Next.js 14 (App Router)**, **TypeScript**, **Supabase (PostgreSQL + RLS + Storage + MFA)**, dan **PWA Offline-First**. Dirancang mengikuti standar **Permen PUPR** (AHSP-RAP), **PSAK 115 / PSAK 207**, **PP 35/2021** (Lembur), serta kontrol tata kelola kontraktor korporat.

---

## Arsitektur 10 Pilar Enterprise & Standar Kontraktor (Gelombang A–F)

| Pilar | Kapabilitas Utama di Produksi |
| :--- | :--- |
| **1. Isolasi Multi-PM & RLS** | Keanggotaan proyek (`project_members`), PostgreSQL Row-Level Security pada seluruh tabel proyek dan tabel anak, serta isolasi query per `activeProjectId`. |
| **2. Hybrid RBAC, Audit & 2FA** | Kombinasi `global_role` (Super Admin, Owner, Finance Manager, Central Procurement, Auditor *read-only*) + `project_role`, **Immutable Audit Log (`INSERT ONLY`)** di `/logs`, **Signed URL 10 menit** pada bucket privat, dan **2FA TOTP Approver** di `/settings/security`. |
| **3. Anggaran 3-Lapisan & Approval Dinamis** | View `v_budget_3layer_wbs` (`Available`, `Committed` PO/SPK/Pending, `Actual`), **Hard-Stop + Pessimistic Lock (`SELECT ... FOR UPDATE`)**, serta **Dynamic Approval Matrix** (`approval_rules`) di `/settings/approval-matrix`. |
| **4. Pengadaan 3-Way Match & Multi-Gudang** | *Document Chaining* (`WBS` -> `PR` -> `PO` -> `GRN` dengan Foto Surat Jalan + GPS/Timestamp -> `Vendor Invoice`), penguncian pembayaran otomatis, **Gudang Pusat vs Site**, **Material Transfer Request**, dan **Stock Opname** di `/materials`. |
| **5. Arus Kas Mandiri, Garansi & BAKP** | **Ring-Fenced Cashflow Guard** (UI + RPC database `SELECT ... FOR UPDATE`), plafon **Dropping HQ** di `/settings/project`, **Bank Garansi & Pengingat Jatuh Tempo Retensi**, serta tarik progres **BAKP** otomatis di `/projects/[projectId]/termin`. |
| **6. Versi RAB Terkunci & CCO** | Penguncian **RAB Baseline (v0)**, **Contract Change Order (CCO / Addendum)** membentuk versi `v1`, `v2`, ... tanpa menghapus histori, serta **Unapproved Work Alert** di `/change-orders`. |
| **7. Kepatuhan Vendor & Scorecard** | **Centralized Vendor Master**, **Blacklist + NPWP/PKP/Legal Expiry Trigger** (otomatis memblokir PO/SPK di seluruh PM), dan **Vendor Performance Scorecard** tertimbang (Waktu 35%, Mutu 35%, K3 30%) di `/vendors/compliance`. |
| **8. Sewa Alat & Custody Aset QR** | **Daily Rental Cost Accrual** idempoten ke `actual_costs`, peringatan masa sewa berakhir (`H-7`/`H-3`), serta **Asset Custody Transfer antar-PM** lengkap dengan generator stiker **QR Code offline** (ISO/IEC 18004) di `/projects/[projectId]/equipment/custody`. |
| **9. HSE Gate & Field Offline Photo** | **HSE / K3 Compliance Gate** (JSA & Work Permit mengunci progres WBS risiko tinggi) di `/qhse` + `/progress`, serta **Offline-First Photo Queue (Dexie v3)** dengan kompresi Canvas otomatis dan `Permissions-Policy: camera=(self)`. |
| **10. Anti-Ghost Workers & Payroll WBS** | Validasi **NIK unik lintas proyek** (blokir absensi hadir ganda pada tanggal sama), perhitungan lembur **PP 35/2021**, dan penautan biaya payroll langsung ke pos `wbs_code` RAB di `/manpower`. |

---

## Migrasi Database Supabase (`supabase/migrations/`)

Seluruh **13 migrasi SQL** bersifat idempoten dan dijalankan berurutan dari `01` hingga `13`:

1. `20261127_01_hybrid_rbac_and_rls.sql` — Hybrid RBAC & Table-wide RLS
2. `20261127_02_immutable_audit_logs.sql` — Immutable Audit Logs (`INSERT ONLY`)
3. `20261127_03_budget_3layer_and_pessimistic_lock.sql` — 3-Layer Budget Views & Lock
4. `20261127_04_dynamic_approval_matrix.sql` — Dynamic Approval Matrix & Tiered RPC
5. `20261127_05_supply_chain_pr_invoice_3way.sql` — PR, Vendor Invoice & 3-Way Match GRN
6. `20261127_06_multi_warehouse_transfer_opname.sql` — Multi-Warehouse, Transfer & Opname
7. `20261127_07_ringfenced_cashflow_and_guarantees.sql` — Ring-Fenced Cashflow & Bank Guarantees
8. `20261127_08_rab_versions_cco_and_unapproved_work.sql` — Locked RAB Versions & CCO
9. `20261127_09_centralized_vendor_blacklist_scorecard.sql` — Centralized Vendor Blacklist & Scorecard
10. `20261127_10_equipment_accrual_and_asset_custody_qr.sql` — Daily Rental Accrual & Asset Custody QR
11. `20261127_11_hse_compliance_gate_and_field_readiness.sql` — HSE JSA/Work Permit Gate
12. `20261127_12_anti_ghost_worker_and_wbs_labor_link.sql` — Anti-Ghost Worker NIK Guard & WBS Payroll
13. `20261128_13_rpc_ringfenced_cashflow_enforcement.sql` — Database-Level Ring-Fenced Cashflow RPC Lock

---

## Pengujian & Deployment Lokal (Windows PowerShell)

```powershell
# Verifikasi menyeluruh (UTF-8 BOM, TypeScript, 11 Jest Suites / 43 Tests, & Next.js Build)
.\PreFlight-Check.ps1

# Atau jalankan manual:
npx tsc --noEmit
npm test -- --ci
npm run build
```

* **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`) menjalankan `tsc --noEmit`, `jest --ci`, dan `next build` sebelum deploy otomatis ke **Vercel Production**.
* **Konvensi Windows PowerShell 5.1:** Saat menulis file `.ts`/`.tsx` secara terprogram, selalu gunakan `[System.IO.File]::WriteAllText(..., [System.Text.UTF8Encoding]::new($false))` agar tidak muncul karakter UTF-8 BOM.
