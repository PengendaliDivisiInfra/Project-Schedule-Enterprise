<div align="center">
  <img src="https://via.placeholder.com/150x150?text=InfraControl" alt="InfraControl PRO Logo" width="120" />
  <h1>🏗️ InfraControl PRO</h1>
  <p><b>Enterprise Construction ERP & Project Controls System</b></p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&style=for-the-badge)](https://nextjs.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&style=for-the-badge)](https://supabase.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&style=for-the-badge)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&style=for-the-badge)](https://tailwindcss.com/)
  [![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel&style=for-the-badge)](https://vercel.com/)
  
  <p><i>Menggabungkan Penjadwalan (CPM), EVM, Akuntansi PSAK 115/207, dan Manajemen Alat Berat dalam Satu Platform Terpadu.</i></p>
</div>

---

## 🌟 Visi & Standar Enterprise
**InfraControl PRO** dirancang untuk menggantikan sistem *spreadsheet* manual dan aplikasi terpisah-pisah. Aplikasi ini mengadopsi standar **Permen PUPR** untuk Analisa Harga Satuan Pekerjaan (AHSP) dan mengimplementasikan algoritma **Project Controls** setara dengan Oracle Primavera P6, dipadukan dengan *Engine* Akuntansi Kelas Perusahaan.

Semua kode ditulis dengan prinsip **100% Type-Safe (TypeScript)**, UI/UX Premium (*Midnight Blue & Glassmorphism*), dan kepatuhan mutlak pada standar *Audit Trail* (Soft Delete & RLS).

---

## 🚀 Modul Utama (V35-C)

### 1. Advanced Project Scheduling (CPM & EVM)
- **CPM Engine**: Full Forward & Backward Pass (ES, EF, LS, LF, Slack, Critical Path).
- **Premium Gantt & WBS**: UI *Sticky Columns*, *Tabular Typography*, dan *Smart Target* harian.
- **EVM S-Curve**: Garis PV, EV, dan AC dipetakan secara proporsional (Cut-off Date).

### 2. Equipment & Fuel Management (Phase 2)
- **Kontrak Sewa (PO)**: Konfigurasi Tarif, Kuota (Jam/Hari), Overtime, dan Limit Normal.
- **Virtual Fuel Tank**: Pelacakan sisa BBM *real-time* (Running Balance) berdasarkan HM. Angka minus dibiarkan sebagai *Red Flag* audit.
- **Approval Workflow**: Penguncian data `Draft` hingga di-`Approve` oleh Site Manager.
- **BAR (Berita Acara Rekonsiliasi)**: Generate PDF tagihan vendor (1 Halaman, Tripartit) dengan kalkulasi Reguler, OT, dan *Auto-Deduction* BBM.

### 3. Financial & Accounting Engine
- **PSAK 115**: Pengakuan Pendapatan Kontrak berbasis *Cost-to-Cost*.
- **PSAK 207**: Laporan Arus Kas (Direct Method).
- **Project Balance Sheet**: Neraca Proyek (Awal, Mutasi, Akhir) dengan *Balance Guard*.

### 4. Material & Resource Management
- **Resource Histogram**: Deteksi *Overallocated* untuk Tenaga Kerja & Alat.
- **Material Requirement Plan**: Konversi AHSP otomatis ke daftar belanja material (dengan *Waste Factor*).

---

## 🛠️ Tech Stack & Architecture

| Layer | Teknologi |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons |
| **Backend/DB** | Supabase (PostgreSQL), RLS Policies, Edge Functions |
| **PDF Engine** | Railway (Puppeteer Core), Pure HTML/CSS (No Tailwind in PDF) |
| **State Mgmt** | React Hooks, Optimistic UI Updates |
| **Deployment** | Vercel (CI/CD via GitHub Actions), Railway |

---

## 🚀 Panduan Instalasi Lokal

1. **Clone Repositori**
   ```bash
   git clone https://github.com/PengendaliDivisiInfra/Project-Schedule-Enterprise.git
   cd Project-Schedule-Enterprise

2. **Install Dependensi**
    npm install

3. **Konfigurasi Environment (.env.local)**
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

4. **Jalankan Server**
    npm run dev

    **Buka http://localhost:3000 di browser Anda.**

🛡️ Absolute Compliance Rules (Developer Guidelines)
Jika Anda berkontribusi pada repository ini, Anda WAJIB mematuhi aturan berikut:

UI/UX: DILARANG menggunakan alert(), confirm(), atau prompt() bawaan browser. Gunakan Custom Modal berbasis React State.

Database: DILARANG melakukan Hard Delete pada data finansial dan inventaris. Gunakan metode Soft Delete (is_deleted = true atau voided_at).

PDF Engine:

NO TAILWIND IN PDF: Gunakan Inline Style / Pure CSS.

NO FLEXBOX/GRID: Layout PDF WAJIB menggunakan <table> murni.

ANTI PAGE-BREAK: Gunakan margin-top: auto; pada footer / Tanda Tangan.

RLS: Wajib mengaktifkan dan membuat policy Row Level Security setiap kali membuat tabel/bucket baru.

🗄️ Struktur Database & Triggers Kunci
Aplikasi ini bergantung pada Database Triggers untuk otomatisasi:

trg_sync_contract_date: Menggeser jadwal task jika tanggal kontrak berubah.

auto_generate_task_assignments: Mengisi tabel assignments dan material requirements dari AHSP.

log_daily_progress(): Mencatat historis harian WBS secara otomatis.

(Lihat file HANDOFF.md untuk detail teknis lengkap dan roadmap).

<div align="center"> <p>Dibangun dengan ❤️ untuk memajukan industri konstruksi Indonesia.</p> <p><b>© 2026 PT. BAngun Kontruksi Persada. Divisi Infratruktur. All Rights Reserved.</b></p> </div> ```
