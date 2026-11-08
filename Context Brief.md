# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V34.1)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V34.1)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar SAK ETAP Bab 23 dan KUP (PPh 4(2) & PPN). 
Fokus V34.1: Sinkronisasi Dokumen (SPK -> BPUTK -> BAPP -> Kwitansi), *Anti-Double Billing*, *Pre-Audit Kepatuhan*, dan *Dynamic COA*.

## 2. DIRECTORY STRUCTURE (VERIFIED)
- `app/projects/[projectId]/subcontractors/page.tsx` : Halaman Induk Tabs Subcon (SOP, Stepper, Guide Drawer).
- `components/coa/COAManagementView.tsx` : UI Master Kode Akun.
- `components/subcon/views/BPUTKView.tsx` : Input fisik & Hapus/Edit.
- `components/subcon/BAPPView.tsx` & `BAOPView.tsx` : Penarikan data BPUTK & kalkulasi pajak.
- `components/subcon/views/KwitansiView.tsx` : Penarikan COA & Soft Delete.
- `components/subcon/views/PaymentCenterView.tsx` : Antrean & Audit SAK/KUP.
- `components/subcon/views/KasbonView.tsx` : Pengajuan Kasbon (Edit/Hapus).
- `components/shared/WorkflowStepper.tsx` : Indikator Stepper UI.
- `components/shared/GuideDrawer.tsx` : Side panel panduan.
- `lib/services/subcon.service.ts` : Pusat CRUD Supabase.
- `lib/hooks/useCOA.ts` : Hook Master COA.
- `lib/utils/sak-calculator.ts` : Engine Pajak.

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V34.1)
- **Sinkronisasi Data**: BPUTK adalah *Single Source of Truth*. Status `is_billed` mencegah 1 BPUTK ditagih dua kali.
- **Auto-Journal SP2D**: Trigger DB otomatis membuat Jurnal Umum saat SP2D diinput di Termin.
- **Compliance Engine**: PaymentCenter melakukan *Pre-Audit* (Cek kalkulasi Gross - Potongan = Netto & Pajak) sebelum mengizinkan pembayaran.
- **Soft Delete Policy**: Data finansial (Kwitansi/Kasbon) yang dihapus hanya diubah statusnya menjadi `VOID` (hilang dari antrean, tetap ada di DB).

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib `ConfirmModal`.
2. **Keuangan**: DILARANG Hard Delete pada data finansial yang sudah masuk antrean. Wajib Soft Delete (VOID).
3. **Print Engine (PDF) - PALING KRUSIAL**:
   - NO TAILWIND IN PDF: Wajib Inline Style / Pure CSS.
   - NO FLEXBOX/GRID IN PDF: Wajib `<table>` murni.
   - ANTI PAGE-BREAK: Container height di-lock (misal `185mm`), TTD `position: absolute; bottom: 20px;`.
   - LOGO LIMIT: `max-height: 45px; max-width: 150px; object-fit: contain;`.

## 5. CURRENT STATE (V34.1 - PRODUCTION READY)
- Modul COA, Termin (SP2D Jurnal), Subcon (BPUTK->BAPP->Kwitansi), Kasbon, dan Payment Center (Audit) selesai.
- Stepper dan Guide Drawer terintegrasi.

## 6. NEXT STEPS (ROADMAP)
- A. Project Master Program (PMP) Print Engine (Cetak Resources & Materials).
- B. Cetak Form GAS Lainnya (Invoice A4, Kontrak Fisik).
- C. Modul Cash Flow Lanjutan.

---
**INSTRUCTION FOR AI:**
Anda adalah *Senior Tech Lead*. Jika diminta menulis kode, pastikan *Type-Safe*, sesuai *Folder Structure*, dan **100% PATUH** pada *Absolute Compliance Rules* (terutama PDF Engine dan UI Modal).

**Katakan "UNDERSTOOD" jika Anda siap.**