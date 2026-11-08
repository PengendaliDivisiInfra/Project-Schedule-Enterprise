# 📋 ENTERPRISE SYSTEM CONTEXT & ARCHITECTURE BRIEF: InfraControl PRO (V34)

**To:** Senior Full-Stack Tech Lead / AI Assistant
**Subject:** Project Onboarding & Context Handoff - InfraControl PRO (V34 - Production Ready)
**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL, RLS, Auth), Railway (Dedicated PDF Microservice), Tailwind CSS, TypeScript.

## 1. PROJECT OVERVIEW
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu (skala Enterprise) dengan standar akuntansi *SAK ETAP Bab 23* dan kepatuhan perpajakan Indonesia (PPh 4(2) & PPN). Aplikasi mencakup berbagai modul: Resources, Inventory, Purchase Order, Termin, Vault, dan Subcontractor Management. 
Fokus saat ini (V34) adalah *High-Fidelity Document Generation* (BAOP, BAPP, BPUTK, Kasbon, Kwitansi) dengan mekanisme *Immutability (Snapshot)* untuk pembekuan data historis saat cetak ulang.

## 2. DIRECTORY STRUCTURE (VERIFIED VIA POWERSHELL)
Aplikasi menggunakan Next.js 14 App Router. Berikut adalah struktur folder krusial yang WAJIB dipatuhi:

📦 promanage-construction
 ┣ 📂 app
 ┃ ┣ 📂 api
 ┃ ┃ ┗ 📂 generate-pdf/route.ts   # Next.js API Route (Proxy ke Railway PDF Service)
 ┃ ┣ 📂 projects/[projectId]/subcontractors/ # Halaman utama Subkon (Tabs: Master, SPK, BAOP, BAPP, Lampiran BAPP, BPUTK, Kasbon, Kwitansi)
 ┃ ┣ 📂 finances/                 # Modul Keuangan Utama
 ┃ ┣ 📂 termin/                   # Modul Termin & Cash In
 ┃ ┣ 📂 vault/                    # Modul Document & Photo Vault
 ┃ ┗ 📜 ...                       # Modul lain (ahsp, tasks, gantt, dll)
 ┣ 📂 components
 ┃ ┣ 📂 subcon/                   # Komponen Modul Subcontractor
 ┃ ┃ ┣ 📂 views/                  # View Full-Page untuk Tab (Clean Architecture)
 ┃ ┃ ┃ ┣ 📜 BPUTKView.tsx
 ┃ ┃ ┃ ┣ 📜 KasbonView.tsx
 ┃ ┃ ┃ ┣ 📜 KwitansiView.tsx      # Modul Kwitansi Pembayaran (Ledger-Style)
 ┃ ┃ ┃ ┗ 📜 LampiranBAPPView.tsx  # Modul Lampiran/Rekapitulasi BAPP
 ┃ ┃ ┣ 📜 BAPPView.tsx            # Modul BAPP Utama
 ┃ ┃ ┣ 📜 BAOPView.tsx            # Modul BAOP
 ┃ ┃ ┣ 📜 BPUTKPrintView.tsx      # Legacy/Alternate Print View
 ┃ ┃ ┣ 📜 ApprovalWorkflowView.tsx# Halaman Finance untuk Approval Kasbon
 ┃ ┃ ┣ 📜 SPKModal.tsx
 ┃ ┃ ┣ 📜 AddendumModal.tsx
 ┃ ┃ ┣ 📜 PaySubconModal.tsx
 ┃ ┃ ┣ 📜 HistoryModal.tsx
 ┃ ┃ ┗ 📜 SubcontractorModal.tsx
 ┃ ┣ 📂 shared/                   # Komponen Reusable lintas modul
 ┃ ┃ ┗ 📜 SignatureSettings.tsx   # Komponen dinamis edit TTD (BAPP, BPUTK, Kasbon, Kwitansi)
 ┃ ┣ 📂 ui/                       # Komponen UI Global
 ┃ ┃ ┣ 📜 MoneyText.tsx
 ┃ ┃ ┣ 📜 ConfirmModal.tsx
 ┃ ┃ ┗ 📜 StatusBadge.tsx
 ┃ ┗ 📂 termin/, vault/, purchase-order/, dll. # Komponen modul lain
 ┣ 📂 lib
 ┃ ┣ 📂 config/permissions.ts     # Matriks RBAC (Owner, PM, Site Admin, dll)
 ┃ ┣ 📂 hooks/useRole.ts          # Hook RBAC (can('PERMISSION_KEY'))
 ┃ ┣ 📂 services/subcon.service.ts# Pusat CRUD Supabase untuk modul Subkon
 ┃ ┣ 📂 types/subcon.ts           # Interface & Types (SignatureItem, SubconReceipt, dll)
 ┃ ┣ 📂 utils/sak-calculator.ts   # The Brains: Engine perhitungan Pajak (SAK/KUP)
 ┃ ┗ 📜 supabase.js               # Supabase Browser Client (JavaScript)
 ┣ 📂 pdf-service/                # Microservice Railway (Puppeteer)
 ┃ ┣ 📜 Dockerfile
 ┃ ┣ 📜 index.js
 ┃ ┗ 📜 package.json
 ┣ 📂 supabase/                   # Migrations & DB Functions
 ┣ 📂 types/                      # Types global (inventory, resource-plan, dll)
 ┗ 📜 middleware.js               # Next.js Middleware (Auth/Routing)

## 3. SYSTEM ARCHITECTURE & CORE LOGIC
*   **The Financial Engine (`lib/utils/sak-calculator.ts`):** Semua kalkulasi (DPP, PPN, PPh, Retensi, Net Transfer) WAJIB menggunakan fungsi `hitungSAK()`. Jangan pernah menghitung manual di komponen UI.
*   **Snapshot / Freeze Data (V34):** Saat mencetak dokumen, nilai pajak dan `signatures` (tanda tangan) dibekukan ke database (tabel `*_documents`). Saat *Cetak Ulang (Reprint)*, UI WAJIB membaca nilai *snapshot* dari database, bukan menghitung ulang dengan state terbaru.
*   **PDF Microservice (Railway):** Aplikasi memanggil `/api/generate-pdf` (Next.js) yang meneruskan *string HTML + CSS* ke Docker `pdf-service/` (Puppeteer) di Railway.
*   **RBAC (Role-Based Access Control):** Menggunakan hook `lib/hooks/useRole.ts` dan fungsi `can('PERMISSION_KEY')` di level UI.

## 4. 🛑 ABSOLUTE COMPLIANCE RULES (DO NOT BREAK)
Sebagai Tech Lead, Anda WAJIB mematuhi aturan *Enterprise* ini:
1.  **UI/UX:** DILARANG KERAS menggunakan `alert()`, `confirm()`, atau `prompt()`. Wajib menggunakan komponen `CustomModal` (contoh: `components/ui/ConfirmModal.tsx`).
2.  **Database:** DILARANG *Hard Delete* untuk data finansial. Gunakan *Soft Delete* (status = 'Void') atau *Reversing Journal*.
3.  **Print Engine (PDF) - *PALING KRUSIAL*:**
    *   **NO TAILWIND IN PDF:** DILARANG menggunakan `className` Tailwind di area cetak. WAJIB menggunakan *Inline Style* atau *Pure CSS* di dalam string HTML template.
    *   **NO FLEXBOX/GRID in PDF:** DILARANG menggunakan `display: flex` atau `grid` untuk layout PDF. WAJIB menggunakan HTML `<table>` murni agar Puppeteer merender presisi.
    *   **ANTI PAGE-BREAK:** Container PDF harus di-lock tingginya (misal `height: 185mm`) dan tanda tangan dikunci dengan `position: absolute; bottom: 20px;` atau `margin-top: auto` di dalam flex-container.
    *   **LOGO LIMIT:** Selalu berikan inline style `max-height: 45px; max-width: 150px; object-fit: contain;` pada logo. Jika tidak, logo akan membesar dan merusak layout PDF.

## 5. CURRENT STATE (V34 - DONE)
*   Modul Kasbon, BPUTK, BAPP, dan BAOP selesai.
*   Fitur Dinamis `SignatureSettings` terintegrasi ke semua dokumen.
*   Mekanisme *Freeze Data (Snapshot)* untuk Reprint berjalan sempurna.
*   Kwitansi Pembayaran (Ledger-Style) dengan Auto-Fill Engine sudah *Production Ready*.

## 6. NEXT STEPS (ROADMAP)
Fokus pengembangan selanjutnya adalah:
1.  **Project Master Program (PMP):** UI Cetak Tabel PMP - Resources & Materials.
2.  **Cetak Form GAS Lainnya:** Invoice Resmi & Kontrak Fisik (A4 Portrait).
3.  **Modul Approval Workflow Lanjutan:** Integrasi persetujuan Kasbon dengan *Cash Flow* Utama.

---
**INSTRUCTION FOR AI:**
Tolong baca dan pahami konteks di atas. Anda akan bertindak sebagai *Senior Tech Lead*. Jika saya meminta Anda untuk menulis kode, pastikan kode tersebut *Type-Safe*, mengikuti *Folder Structure* di atas, dan **100% PATUH** terhadap *Absolute Compliance Rules* (terutama terkait PDF Engine dan UI Modal). 

**Katakan "UNDERSTOOD" jika Anda sudah memahami dan siap menerima instruksi selanjutnya.**