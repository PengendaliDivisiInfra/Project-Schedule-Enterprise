# Project Schedule Management System (Enterprise Grade)

Aplikasi manajemen proyek konstruksi berbasis web (ERP) yang dirancang untuk memonitoring jadwal (S-Curve), RAB, Earned Value Management (EVM), serta manajemen Harga Satuan (AHSP/HSD) sesuai standar PUPR dan MS Project Professional.

## 🚀 Tech Stack
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Recharts (Grafik)
- **Backend & Database:** Supabase (PostgreSQL) dengan Database Trigger
- **Deployment:** Vercel & GitHub Actions (CI/CD)

## ✨ Fitur Utama (V5)
- **CPM Engine (MS Project Standard):** Perhitungan Forward/Backward Pass, Kalender Kerja (skip weekend), deteksi Jalur Kritis (Critical Path), dan Rollup WBS (Induk-Anak).
- **EVM & S-Curve Dinamis:** Grafik S-Curve (PV, EV, AC) yang presisi dan dipotong tepat di Status Date. Kalkulasi SPI, CPI, ETC, EAC, VAC, dan TCPI secara otomatis.
- **Katalog AHSP (PUPR):** Tabel A, B, C, D, E, F sesuai standar, persentase Overhead yang bisa diedit, serta fitur Traceability.
- **Global Price Invalidation:** Menggunakan Database Trigger PostgreSQL. Jika harga material di HSD berubah, harga AHSP otomatis ter-update di database tanpa perlu refresh manual.
- **Resource Management:** Pembedaan tipe Work, Material, dan Cost. Sinkronisasi biaya *Bottom-Up* dari anak ke induk secara otomatis.
- **Dual-Mode Input:** Input komponen HSD langsung dari form AHSP (jika belum ada) atau memilih dari Master HSD (jika sudah ada).

## ⚙️ Environment Variables
Buat file `.env.local` di root direktori:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
🛠️ Cara Menjalankan Secara Lokal
Clone repository ini

Jalankan npm install

Setup file .env.local

Jalankan npm run dev

Buka http://localhost:3000
