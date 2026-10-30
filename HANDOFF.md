# Project Handoff Document - Promanage Construction

**Status Proyek:** 🟢 Production Ready (V5)
**Developer Utama:** [Nama Anda]

---

## 1. Status Saat Ini (Current Status)
Sistem telah mencapai tahap *Enterprise Grade* dengan stabilitas perhitungan matematis yang tinggi.
- **Fixed:** Bug duplikasi WBS pada halaman Assignments dan bug perhitungan Rp 0 saat tombol Sync diklik.
- **Added:** Auto-Rollup pada saat load halaman (Induk langsung menghitung total biaya anak).
- **Added:** Database Trigger untuk *Global Price Invalidation* (Update harga HSD langsung memicu update harga AHSP).
- **Added:** CPM Engine lengkap dengan dukungan Predecessor (FS, SS, FF, SF), Kalender Kerja, dan Critical Path (Warna Merah).
- **Added:** EVM Forecasting (ETC, EAC, VAC, TCPI) pada halaman Dashboard.

## 2. Yang Sedang Berjalan (Work in Progress)
- Implementasi Web Worker untuk memindahkan proses kalkulasi CPM/Tree yang berat ke background thread agar UI tidak freeze saat data mencapai ribuan baris.

## 3. Known Issues (Masalah yang Diketahui)
- Error 'GoTrueClient instances' di console browser (aman, efek dari React StrictMode).
- Tampilan grafik S-Curve memerlukan data Actual Cost (AC) harian yang riil (saat ini AC diasumsikan sama dengan PV jika progress 100%).

## 4. Panduan Developer Selanjutnya (Next Steps)
1. **Resource Leveling:** Terapkan algoritma 'applyResourceLeveling' untuk mendeteksi Overallocated (pekerja yang ditugaskan di 2 tempat pada tanggal yang sama) dan menggeser jadwal secara otomatis tanpa melanggar Jalur Kritis.
2. **Daily Progress Input:** Buat halaman UI untuk memasukkan progres harian (Actual Cost & Actual Progress) agar garis EV dan AC pada S-Curve dapat berpotongan secara akurat sesuai kondisi lapangan.
3. **Autentikasi:** Implementasikan Supabase Auth (Login/Register) sebelum aplikasi digunakan oleh banyak user.

## 5. Akses & Kontak
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository GitHub:** [Link GitHub]
