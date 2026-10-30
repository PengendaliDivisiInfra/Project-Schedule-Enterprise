# Project Schedule Management System

Aplikasi manajemen proyek konstruksi berbasis web yang dirancang untuk memonitoring jadwal (S-Curve), Rencana Anggaran Biaya (RAB), Earned Value Management (EVM), dan manajemen sumber daya.

## 🚀 Tech Stack
- **Framework:** Next.js (App Router)
- **Database & Auth:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel & GitHub Actions (CI/CD)

## ✨ Fitur Utama
- **Dashboard & S-Curve:** Visualisasi Planned Value (PV), Earned Value (EV), dan Actual Cost (AC).
- **Task Management (WBS):** Manajemen hierarki pekerjaan, durasi, dan progres.
- **HSD (Harga Satuan Dasar):** Manajemen database harga material, upah, dan alat.
- **AHSP:** Analisa Harga Satuan Pekerjaan (Dalam Pengembangan).
- **Resources & Assignments:** Manajemen penugasan sumber daya (Dalam Pengembangan).

## ⚙️ Environment Variables
Buat file `.env.local` di root direktori dan tambahkan variabel berikut:
`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
`",
",

1. Clone repository ini
2. Jalankan `npm install`
3. Setup file `.env.local`
4. Jalankan `npm run dev`
5. Buka `http://localhost:3000`
