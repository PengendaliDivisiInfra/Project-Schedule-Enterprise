# 🏗️ InfraControl PRO - Enterprise Project Schedule

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-blue?logo=tailwind-css)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://vercel.com/)

**InfraControl PRO** adalah sistem manajemen dan pengendalian proyek konstruksi (Project Controls) kelas Enterprise yang dirancang untuk menggabungkan penjadwalan (CPM), analisis nilai hasil (EVM), dan manajemen sumber daya (Resource & Material) dalam satu platform terpadu.

Aplikasi ini mengadopsi standar **Permen PUPR** untuk Analisa Harga Satuan Pekerjaan (AHSP) dan mengimplementasikan algoritma **Project Controls** yang setara dengan Oracle Primavera P6 atau Microsoft Project.

---

## ✨ Fitur Utama (V15 - Enterprise Edition)

### 1. CPM Engine (Critical Path Method)
- **Full Forward & Backward Pass**: Menghitung ES, EF, LS, LF, Slack, dan Critical Path secara otomatis.
- **Constraint & Predecessor**: Mendukung hubungan FS, SS, FF, SF beserta Lag/Lead, dan *Constraint* (ASAP, SNET, MSO, MFO, dll).
- **Task Mode**: Pemisahan mutlak antara penjadwalan *Auto* (dikontrol mesin) dan *Manual* (dikunci oleh pengguna).
- **Anti-Hang Protection**: Dilengkapi pengaman untuk mencegah browser *freeze* saat terjadi kalkulasi berulang.

### 2. Earned Value Management (EVM)
- **Volume Realisasi**: Input progres berdasarkan volume fisik (bukan sekadar persentase).
- **Smart Target**: Menghitung target rencana harian berdasarkan kurva S dan kalender kerja.
- **Varian & T/Hari**: Memberikan peringatan visual (Merah/Hijau) jika proyek terlambat atau lebih cepat, beserta target harian yang harus dikejar.

### 3. Resource & Material Management
- **Resource Histogram**: Menghitung beban kerja Tenaga Kerja (Man-Hours) dan Alat (Machine-Hours) serta deteksi *Overallocated*.
- **Material Requirement Plan**: Otomatisasi konversi AHSP menjadi daftar belanja material, termasuk perhitungan *Waste Factor* (5%) dan *Delivery Rate* mingguan.

### 4. Otomatisasi AHSP (Permen PUPR)
- **Auto-Generate Resources**: Memasukkan komponen Tenaga, Alat, dan Bahan secara otomatis ke dalam Task saat AHSP di-*assign*.
- **Dynamic HSD**: Sinkronisasi Harga Satuan Dasar (HSD) ke dalam perhitungan RAB.

---

## 🛠️ Teknologi yang Digunakan
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend/Database**: Supabase (PostgreSQL), Row Level Security (RLS).
- **State Management**: React Hooks (Optimistic UI Updates, 0ms loading).
- **Deployment**: Vercel (CI/CD via GitHub Actions).

---

## 🚀 Panduan Instalasi Lokal

1. **Clone Repositori**
   ```bash
   git clone https://github.com/PengendaliDivisiInfra/Project-Schedule-Enterprise.git
   cd Project-Schedule-Enterprise

2. **Install Dependensi**
    npm install

3. **Konfigurasi Environment (Supabase)**
    Buat file .env.local di root direktori dan tambahkan kunci Supabase Anda:
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

4. **Jalankan Server Development**
    npm run dev
    Buka http://localhost:3000 di browser Anda.

🗄️ Struktur Database & Triggers Kunci
Aplikasi ini sangat bergantung pada Database Triggers untuk otomatisasi. Pastikan trigger berikut aktif di Supabase:

trg_sync_contract_date: Menggeser seluruh jadwal task jika tanggal kontrak diubah.

auto_generate_task_assignments: Otomatis mengisi tabel task_assignments dan task_material_requirements dari data AHSP.

(Lihat file HANDOFF.md untuk dokumentasi teknis lengkap dan roadmap pengembangan).

👨‍💻 Kontributor
Pengendali Divisi Infra - Lead Developer & Project Controls Engineer

Dibangun dengan ❤️ untuk memajukan industri konstruksi Indonesia.