# Project Handoff Document - InfraControl PRO

**Status Proyek:** 🟢 Production Ready (V25 - Enterprise PMP & Server-Side PDF Engine)
**Terakhir Diperbarui:** 04 November 2026
**Developer Utama:** [Nama Anda]

---

## 1. Status Saat Ini (Implemented Features)
Aplikasi **InfraControl PRO** telah melalui perombakan besar pada modul **Master Project Report (PMP)**. Sistem kini telah sepenuhnya meninggalkan metode cetak bawaan browser yang rentan *crash* dan beralih ke arsitektur **Server-Side PDF Generation**.

### Fitur Utama yang Sudah Selesai (V25 Updates):

- **Server-Side PDF Engine (Puppeteer):**
  - Menggunakan `puppeteer` via API Route (`/api/generate-pdf`) untuk merender laporan menjadi PDF.
  - **Bebas Hang:** Browser tidak lagi macet di status "Memuat pratinjau...". Proses cetak dilakukan di latar belakang server.
  - **Dynamic Scale:** Laporan otomatis menyesuaikan skala (Zoom Out) jika pengguna memilih skala *Harian* atau *Mingguan* dengan rentang tanggal yang panjang, memastikan tabel tidak terpotong.
- **Desain Gantt Chart MS Project Style:**
  - **Bars:** Berbentuk kapsul (Pill Shape) dengan border-radius dinamis. Warna menyatu sempurna (solid) tanpa terputus antar sel.
  - **Kolom Lengkap:** Menampilkan kolom `VOL`, `SISA VOL`, `DUR`, `START`, `FINISH`, `PRED`, `%`, `TARGET`, `VARIAN`, dan `T/HR`. (Kolom Slack & Cost disembunyikan untuk efisiensi).
  - **Timeline Vertikal:** Header tanggal di-rotate 90 derajat agar rapi saat dicetak.
  - **Dependency Arrows:** Garis ketergantungan oranye (SVG) dirender presisi dari ujung bar pendahulu ke awal bar target.
- **Tata Letak Cetak Enterprise (A3 & A4):**
  - Menggunakan *Named Pages* CSS (`@page gantt_layout` dan `@page matrix_layout`) untuk menghasilkan PDF dengan orientasi kertas ganda (A3 Landscape untuk Gantt, A4 Landscape untuk Matriks).
  - **Tanda Tangan (Sign-off):** Dibuat menggunakan *HTML Table Layout* murni (bukan Flexbox/Grid) untuk menjamin 3 kolom tanda tangan sejajar sempurna di halaman terakhir PDF.
- **Sinkronisasi Data (Roll-up Date):**
  - Fungsi `recalculateRollupDates` berjalan di *frontend* sebelum render, memastikan tanggal `MIN` dan `MAX` dari sub-task otomatis terakumulasi ke Summary Task (WBS Utama).
- **Optimasi Konfigurasi Next.js:**
  - `next.config.js` telah diperbarui dengan `serverComponentsExternalPackages` untuk memastikan Puppeteer berjalan lancar tanpa peringatan (warning).

---

## 2. Gap Analysis (Sisa Pekerjaan / Next Steps)
Meskipun modul laporan sudah sangat matang, secara keseluruhan aplikasi masih memerlukan beberapa fitur untuk rilis final:

1.  **Authentication & RBAC:** Menerapkan Login/Register (Supabase Auth) dan pembatasan hak akses (Owner, PM, Site Admin).
2.  **Audit Logs:** Mencatat setiap perubahan data (siapa, kapan, apa yang diubah).
3.  **Refining Other PDF Matrices:** Memastikan modul *Resource Plan* dan *Material Plan* di dalam PDF (Halaman 3 & 4) memiliki penyesuaian desain jika diperlukan (saat ini sudah rapi, tapi bisa disesuaikan kolomnya).

---

## 3. Panduan Developer Selanjutnya (SANGAT PENTING)
- **Build:** `npm run build`
- **Deploy:** `git push origin main` (Otomatis via Vercel).
- **Catatan Penting Print Engine:**
  - **Jangan** menghapus `executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'` di `app/api/generate-pdf/route.js` jika berjalan di Windows lokal.
  - Untuk **deploy ke Vercel**, Anda perlu mengubah `executablePath` menggunakan `@sparticuz/chromium` agar ukuran *Serverless Function* tidak melebihi batas Vercel.
  - CSS Cetak (Print Styles) di `page.jsx` **wajib menggunakan CSS murni (Vanilla CSS)**. Jangan gunakan Tailwind di area `#print-section` karena Puppeteer tidak akan membacanya dengan benar.
- **Database Notes:**
  - **JANGAN** mengubah logika `GROUP BY` pada View SQL tanpa melakukan *Drop View* terlebih dahulu.
  - Selalu jalankan `NOTIFY pgrst, 'reload schema';` setelah mengubah View/Trigger.

## 4. Akses & Kontak
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository GitHub:** [Link GitHub]