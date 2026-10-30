# Project Handoff Document

**Status Proyek:** 🟢 Aktif (Production Ready - Beta)
**Developer Utama:** [Nama Anda/Tim Anda]

---

## 1. Status Saat Ini (Current Status)
Sistem telah berhasil di-deploy ke Vercel dan terhubung dengan Supabase. 
- **Fixed:** Error build `supabaseKey is required` pada API Routes (sudah dipindahkan ke runtime `force-dynamic`).
- **Fixed:** Grafik S-Curve kosong (masalah parsing format angka Rupiah dan kalkulasi rentang tanggal).
- **Added:** Layout aplikasi standar dengan Sidebar Navigasi.
- **Added:** Halaman UI dasar untuk Tasks (WBS) dan HSD.

## 2. Yang Sedang Berjalan (Work in Progress)
- Implementasi UI penuh untuk modul **AHSP**, **Resources**, dan **Assignments**.
- Fitur CRUD (Create, Read, Update, Delete) pada tabel *Tasks* dan *HSD* (saat ini hanya *Read*).

## 3. Known Issues (Masalah yang Diketahui)
- `project_id` pada halaman `tasks/page.jsx` dan `hsd/page.jsx` masih di-*hardcode*. Perlu dibuatkan sistem *Project Selector* di Navbar.
- Beberapa halaman masih berupa *placeholder*.

## 4. Panduan Developer Selanjutnya (Next Steps)
1. **Ganti Hardcode ID:** Cari `GANTI_DENGAN_ID_PROJECT_ANDA` di folder `app/tasks` dan `app/hsd`, lalu ganti dengan implementasi state global.
2. **Buat Form Input:** Tambahkan form modal atau halaman baru untuk melakukan *Insert* dan *Update* data ke Supabase.
3. **Selesaikan Modul AHSP:** Buat relasi antara tabel `ahsp_details`, `master_hsd`, dan `wbs_tasks`.

## 5. Kontak & Akses
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository:** [Link GitHub]
