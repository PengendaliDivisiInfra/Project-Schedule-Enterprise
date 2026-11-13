# 📑 PROJECT HANDOFF DOCUMENT - INFRA CONTROL PRO

**Status Proyek:** 🚀 Production Ready (V35-E - Enterprise Gold Standard)
**Terakhir Diperbarui:** 16 November 2026
**Environment Setup:** Next.js 14, Vercel, Railway (Puppeteer), Supabase (PostgreSQL, RLS, Storage).

## 1. EXECUTIVE SUMMARY
InfraControl PRO adalah Sistem ERP Konstruksi Terpadu dengan standar akuntansi **PSAK 115**, **PSAK 207**, dan **Project Balance Sheet**. Fokus V35-E adalah penutupan celah keamanan (**Multi-Tenancy RLS**) dan penyelesaian fitur **Setup Proyek Baru (Wizard)** yang mempermudah inisialisasi proyek sekaligus mendaftarkan Admin sebagai PM secara otomatis.

## 2. IMPLEMENTED FEATURES (V35-E)

### A. Multi-Tenancy & Security Audit (V35-D)
- **Database RLS (Row Level Security)**: Implementasi fungsi `is_project_member` dan `has_project_role` pada seluruh tabel inti (`projects`, `wbs_tasks`, `cash_flows`, `equipment_*`, `fuel_*`). Isolasi data 100% antar proyek.
- **Security Fallback**: Memperbaiki `useRole.ts`. User tanpa role proyek otomatis menjadi `Guest` (Akses ditolak), menghilangkan celah *Bypass* `Site Admin`.
- **No Service Role Leak**: Memastikan `SERVICE_ROLE` hanya berjalan di server/API.

### B. Setup Proyek Baru (Wizard) (V35-E)
- **3-Step Wizard**: UI interaktif di `/projects/new` untuk input Informasi Utama, Kalender & Waktu, serta Legalitas.
- **Auto-Assign PM**: Sistem otomatis mendaftarkan Admin ke tabel `project_members` dengan role `Project Manager` saat proyek dibuat.
- **Auto-Redirect**: Setelah proyek dibuat, sistem langsung mengarahkan user ke halaman `Tugas (WBS)`.

### C. UI/UX Compliance (Zero `alert`/`confirm`)
- **Global Toast**: Membuat `ToastListener.jsx` dan mengganti semua `alert()` di `useProjectStore.js` dengan `CustomEvent`.
- **Custom Modal Hapus**: Mengganti `confirm()` di Manajemen Tim (`settings/team`) dengan Custom Modal elegan.
- **Sidebar Restructure**: Memindahkan menu "Manajemen Proyek" ke bawah kategori "SISTEM" untuk UX yang lebih baik.

## 3. ARCHITECTURE & CORE LOGIC
- **Database Triggers (Supabase)**: `log_daily_progress()` berjalan normal.
- **Schema Note**: RLS Policies terpasang ketat pada semua tabel. Tidak ada `public` policy yang terbuka.

## 4. 🛑 ABSOLUTE RULES (DO NOT BREAK)
1. **UI/UX**: DILARANG `alert()`, `confirm()`, `prompt()`. Wajib Custom Modal / Toast.
2. **Database**: DILARANG Hard Delete pada data finansial & inventaris. Gunakan Soft Delete (`is_deleted` / `voided_at`).
3. **Print Engine**: NO TAILWIND IN PDF, NO FLEXBOX/GRID, WAJIB `<table>` murni, ANTI PAGE-BREAK.
4. **RLS**: Wajib update Row Level Security setiap membuat tabel/bucket baru.

## 5. NEXT STEPS (ROADMAP SPRINT V35-F KE ATAS)
- **A. Modul Rekonsiliasi Bank (CSV Upload)**: 
  Fitur unggah mutasi rekening bank (BCA/Mandiri/BRI) untuk dicocokkan dengan Arus Kas (Auto-Matching).
- **B. Modul Document Control & RFI**: 
  Integrasi Supabase Storage untuk manajemen dokumen (Shop Drawing, Addendum) dengan *Versioning*, *Link to WBS*, dan fitur *Request for Information* (RFI).
- **C. Upgrade Modul QHSE (Punch List & Inspection)**: 
  Digital checklist inspeksi (ITP), *Defect Tracking* (Punch List) dengan foto, dan *Safety Report* (K3).
- **D. Modul Manajemen Gudang (Warehouse Management)**: 
  Pencatatan *Stock In* (Penerimaan) dan *Stock Out* (Pemakaian) material. Otomatis masuk ke *actual_costs* (Auto-Cost) dan fitur *Stock Opname*.
- **E. PWA & Mobile-First View**: 
  Optimasi UI untuk *Site Engineer* di lapangan (HP/Tablet) dengan fitur *Offline Mode* (IndexedDB) untuk input progres harian.
- **F. Executive Multi-Project Dashboard**: 
  Dasbor khusus Owner untuk melihat agregasi SPI, CPI, dan Margin dari **seluruh proyek** sekaligus.
- **G. Sinkronisasi API Pajak / e-Faktur (Opsional)**.

## 6. WORKFLOW GIT & DEPLOYMENT
1. `npm run build` (Pastikan 0 error, validasi TypeScript lolos).
2. `git add .`
3. `git commit -m "docs(V35-E): Update Roadmap V35-F dengan 5 Rekomendasi Modul Baru"`
4. `git push origin main` (Otomatis trigger GitHub Actions -> Vercel).