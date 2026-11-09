# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V34.1)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V34.1)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Storage, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (Enterprise-Grade) dengan standar SAK ETAP Bab 23 dan KUP (PPh 4(2) & PPN). 
Fokus V34.1: Sinkronisasi Dokumen, *Anti-Double Billing*, *Pre-Audit Kepatuhan*, *Dynamic COA*, **SPK Print Engine**, dan **PMP Print Engine**.

## 2. DIRECTORY STRUCTURE (VERIFIED)
- `app/projects/[projectId]/subcontractors/page.tsx` : Halaman Induk Tabs Subcon.
- `app/projects/[projectId]/subcontractors/spk/[spkId]/print/page.tsx` : Halaman Server Component untuk render PDF SPK.
- `app/projects/[projectId]/subcontractors/spk/[spkId]/print/PrintClientWrapper.tsx` : Client component untuk UI Preview PDF A4 (Split Screen).
- `app/reports/master/page.jsx` : Halaman PMP Print Engine (A3).
- `app/api/generate-pdf/route.ts` : Proxy Next.js ke Railway PDF Service (mendukung parameter `footerTemplate`).
- `components/coa/COAManagementView.tsx` : UI Master Kode Akun.
- `components/subcon/SPKModal.tsx` : Form Input SPK (termasuk Upload KTP & Logika SAK ETAP).
- `components/subcon/SubcontractorModal.tsx` : Form Master Vendor (CRUD + Tarif PPh PP 9/2022).
- `components/subcon/views/*` : BPUTKView, KwitansiView, PaymentCenterView, KasbonView.
- `components/spk/SPKPrintTemplate.tsx` : Template PDF SPK (Pure HTML/Inline CSS).
- `lib/services/subcon.service.ts` : Pusat CRUD Supabase.
- `lib/utils/sak-calculator.ts` : Engine Pajak.

## 3. SYSTEM ARCHITECTURE & CORE LOGIC (V34.1)
- **Sinkronisasi Data**: BPUTK adalah *Single Source of Truth*. Status `is_billed` mencegah 1 BPUTK ditagih dua kali.
- **Auto-Journal SP2D**: Trigger DB otomatis membuat Jurnal Umum saat SP2D diinput di Termin.
- **Compliance Engine**: PaymentCenter melakukan *Pre-Audit* (Cek Gross - Potongan = Netto & Pajak) sebelum mengizinkan pembayaran.
- **SPK & SAK ETAP Logic**: Perhitungan SPK membedakan `EXCLUDE`, `INCLUDE`, dan `NON_PAJAK`. PPh Final PP 9/2022 otomatis ditarik dari Master Vendor (`pph_rate`) ke Form SPK.
- **Soft Delete Policy**: Data finansial (Kwitansi/Kasbon/SPK) dihapus dengan status `VOID`.
- **Deploy Protection**: `vercel.json` menggunakan `installCommand: "npm install --ignore-scripts"`.

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib `ConfirmModal`.
2. **Keuangan**: DILARANG Hard Delete pada data finansial. Wajib Soft Delete (VOID).
3. **Print Engine (PDF) - PALING KRUSIAL**:
   - NO TAILWIND IN PDF: Wajib Inline Style / Pure CSS.
   - NO FLEXBOX/GRID IN PDF: Wajib `<table>` murni.
   - ANTI PAGE-BREAK: Single page (Invoice) gunakan height lock `185mm`. Multi-page (SPK) gunakan margin `@page` dan `position: fixed` untuk footer.
   - LOGO LIMIT: `max-height: 45px; max-width: 150px; object-fit: contain;`.
   - Wajib update RLS setiap membuat tabel/bucket baru.

## 5. CURRENT STATE (V34.1 - PRODUCTION READY)
- Modul COA, Termin, Subcon, Kasbon, Payment Center selesai.
- **SPK Print Engine (A4) SELESAI**: Termasuk TTD Dinamis, Upload KTP (Supabase Storage), Logika Pajak PP 9/2022, dan Preview PDF interaktif.
- **Master Vendor SELESAI**: Mendukung Edit, Kualifikasi SBU, dan Tarif PPh.

## 6. NEXT STEPS (ROADMAP)
- A. Cetak Form GAS Lainnya (Invoice Resmi A4, Kontrak Fisik).
- B. Modul Cash Flow Lanjutan (Rekonsiliasi Bank, Dashboard Financial Health).

---
**INSTRUCTION FOR AI:**
Anda adalah *Senior Tech Lead*. Jika diminta menulis kode, pastikan *Type-Safe*, sesuai *Folder Structure*, dan **100% PATUH** pada *Absolute Compliance Rules* (terutama PDF Engine dan UI Modal).

**Katakan "UNDERSTOOD" jika Anda siap.**