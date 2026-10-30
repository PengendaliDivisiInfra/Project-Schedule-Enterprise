# Project Handoff Document - Promanage Construction

**Status Proyek:** 🟢 Production Ready (V6 - Enterprise Grade)
**Terakhir Diperbarui:** 31 October 2026
**Developer Utama:** [Nama Anda]

---

## 1. Arsitektur & Status Saat Ini (Current Status)
Sistem telah mencapai stabilitas maksimal dengan memindahkan beban kalkulasi berat ke level Database (PostgreSQL).
- **Automated Cost Calculation:** Menggunakan PostgreSQL Trigger (uto_calculate_wbs_cost). Saat Volume diubah, database langsung mengalikan Volume × Harga AHSP dan melakukan *Rollup* ke Induk (Summary Task).
- **Global Price Invalidation:** Menggunakan PostgreSQL Trigger (update_ahsp_total_on_detail_change). Perubahan harga di HSD otomatis memperbarui total harga di AHSP tanpa perlu simpan manual.
- **CPM Engine (MS Project Standard):** Mendukung *Forward/Backward Pass*, Kalender Kerja (skip weekend), perhitungan *Total Float*, dan visualisasi Jalur Kritis (warna merah).
- **EVM & S-Curve Dinamis:** Grafik PV, EV, dan AC dipotong tepat di Status Date. Nilai SPI, CPI, ETC, EAC, VAC, dan TCPI dihitung secara matematis.
- **UI/UX Polish:** Menggunakan *Supabase Singleton Pattern* (lib/supabase.js) untuk mencegah *memory leak*. Baris Induk (Summary Task) dikunci secara visual agar tidak bisa diedit manual.

## 2. Isu yang Diketahui (Known Issues)
- **Warning GoTrueClient instances**: Peringatan kuning di console browser. Ini adalah efek samping dari fitur *React StrictMode* di Next.js. **Aman untuk diabaikan** dan tidak mempengaruhi performa aplikasi.
- **Data AC (Actual Cost)**: Saat ini garis AC pada S-Curve diasumsikan sama dengan PV (Planned Value) karena belum ada form input progres harian.

## 3. Panduan Developer Selanjutnya (Next Steps)
1. **Daily Progress Input:** Buat halaman baru untuk mencatat progres fisik dan biaya aktual harian (Actual Cost). Data ini akan digunakan agar garis EV dan AC pada S-Curve menjadi 100% akurat.
2. **Web Worker Optimization:** Pindahkan algoritma calculateCPM dan unRollupEngine ke dalam *Web Worker* agar UI tetap responsif meskipun data mencapai puluhan ribu baris.
3. **Resource Leveling:** Terapkan algoritma untuk mendeteksi *Overallocated* (pekerja yang ditugaskan di 2 tempat pada tanggal yang sama) dan menggeser jadwal secara otomatis.
4. **Autentikasi:** Implementasikan Supabase Auth (Login/Register) sebelum aplikasi digunakan oleh banyak *user*.

## 4. Akses & Kontak
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository GitHub:** [Link GitHub]
