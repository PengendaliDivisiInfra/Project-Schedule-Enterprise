# Project Handoff Document - Promanage Construction

**Status Proyek:** 🟢 Aktif (Production Ready - V4)
**Terakhir Diperbarui:** [Tanggal Hari Ini]
**Developer Utama:** [Nama Anda/Tim Anda]

---

## 1. Ringkasan Proyek
Aplikasi manajemen proyek konstruksi berbasis web (ERP) yang dirancang untuk memonitoring jadwal (S-Curve), RAB, Earned Value Management (EVM), serta manajemen Harga Satuan (AHSP/HSD) sesuai standar PUPR.

## 2. Tech Stack
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Recharts (Grafik)
- **Backend & Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel & GitHub Actions (CI/CD)

## 3. Status Fitur Saat Ini
- ✅ **Dashboard S-Curve:** Menampilkan grafik PV, EV, AC (memerlukan input biaya manual di Task untuk saat ini).
- ✅ **Gantt Chart (MS Project Style):** Visualisasi timeline WBS dengan warna bar berdasarkan progres.
- ✅ **Manajemen Tasks (WBS):** CRUD penuh (Tambah, Edit, Hapus), pengaturan tanggal, durasi, progres, dan biaya.
- ✅ **Katalog AHSP (PUPR):** Tabel A, B, C, D, E, F sesuai standar, persentase Overhead yang bisa diedit, serta fitur Edit Nama/Satuan dan Hapus Katalog.
- ✅ **Dual-Mode HSD & AHSP:** Input komponen AHSP bisa langsung mengetik data baru (otomatis masuk Master HSD) atau memilih dari daftar HSD yang sudah ada.
- ✅ **Traceability (Pelacakan):** Halaman HSD menampilkan informasi material tersebut dipakai di AHSP mana dan Task mana.

## 4. Isu Diketahui (Known Issues)
- **Rumus Biaya Task:** Biaya (Cost) pada Task masih diinput manual. Belum otomatis mengambil dari (Volume Task x Harga Satuan AHSP).
- **Halaman Resources:** Masih menampilkan agregasi dasar dari volume task.
- **Keamanan Database:** RLS (Row Level Security) saat ini dinonaktifkan (`DISABLE ROW LEVEL SECURITY`) pada tabel utama untuk mempermudah *development* dan *testing*. **Wajib diaktifkan kembali** sebelum aplikasi digunakan oleh publik secara luas dengan aturan yang ketat.
- Peringatan `GoTrueClient instances` di console browser (aman, hanya efek dari React StrictMode).

## 5. Panduan Developer Selanjutnya (Next Steps)
1. **Integrasi AHSP ke Task:** Ubah halaman `Assignments` agar saat memilih AHSP dan memasukkan Volume, sistem otomatis menghitung `Total Biaya = Volume * Harga Satuan AHSP (Total F)` dan menyimpannya ke tabel `wbs_tasks`. Ini akan membuat Dashboard S-Curve otomatis tanpa perlu input manual biaya.
2. **Algoritma CPM:** Tambahkan perhitungan Critical Path Method (Jalur Kritis) pada tombol "Recalculate CPM".
3. **Autentikasi:** Tambahkan fitur Login/Sign-up menggunakan Supabase Auth.

## 6. Akses & Kontak
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository GitHub:** [Link GitHub]
