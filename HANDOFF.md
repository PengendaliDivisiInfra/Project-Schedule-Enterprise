# Project Handoff Document - InfraControl PRO

**Status Proyek:** 🟢 Production Ready (V26 - Enterprise PMP, Dynamic Gantt & Server-Side PDF Engine)  
**Terakhir Diperbarui:** 05 November 2026  
**Developer Utama:** [Nama Anda]  
**Environment Setup:** Windows PowerShell (Local), Vercel (Production)

---

## 1. Status Saat Ini (Implemented Features)

Aplikasi **InfraControl PRO** telah melalui perombakan besar pada modul **Master Project Report (PMP)**. Sistem telah meninggalkan metode cetak bawaan browser dan beralih ke arsitektur **Server-Side PDF Generation** menggunakan Puppeteer. 

### Fitur Utama yang Selesai (V26 Updates):

- **Server-Side PDF Engine (Puppeteer & Chromium):**
  - Menggunakan `puppeteer-core` dan `@sparticuz/chromium` via API Route (`/api/generate-pdf`) untuk merender laporan PDF di environment Vercel (Serverless).
  - **Anti-Hang & Infinite Loop:** Memisahkan antara *Initial Load* dan *Background Update* (Supabase Realtime) pada fungsi `fetchData` untuk mencegah UI terjebak di *loading spinner*.
- **Desain Gantt Chart "Enterprise Bubble" (MS Project Style):**
  - **Bars:** Berbentuk kapsul (*Pill Shape* / `border-radius: 999px`) dengan efek gradien linear dan *drop shadow* tipis. Sangat elegan dan ringkas (tinggi bar disesuaikan menjadi 8px).
  - **Full-Width A3:** Kalkulasi lebar kolom tabel dilakukan secara dinamis menggunakan JavaScript (`COL_WIDTH`) agar bar chart selalu memenuhi kertas A3 Landscape tanpa menyisakan ruang kosong.
  - **Penghapusan SVG Panah:** Garis ketergantungan (Dependency Lines) berbasis SVG dihapus total karena sering merusak tata letak saat dicetak. Fokus beralih ke visualisasi bar yang bersih.
  - **Kolom Lengkap & Proporsional:** Lebar kolom `URAIAN`, `RENCANA`, `VARIAN`, dan `T/HR` telah dikalibrasi ulang agar teks tidak saling tumpang tindih (overlap) saat dicetak.
- **Tata Letak Cetak (CSS Paged Media):**
  - Menggunakan *Named Pages* CSS (`@page gantt_layout` dan `@page matrix_layout`) untuk hasil PDF dengan orientasi kertas ganda (A3 Landscape untuk Gantt, A4 Landscape untuk Matriks).
  - **Tanda Tangan (Sign-off):** Dibuat menggunakan *HTML Table Layout* murni untuk menjamin 3 kolom tanda tangan sejajar sempurna di halaman terakhir PDF.
- **Sinkronisasi Data & EVM Dinamis:**
  - Fungsi `recalculateRollupDates` dan `calculateEVM` berjalan di *frontend* untuk menghitung Target Rencana, Realisasi, Varian, dan Sisa Hari secara *real-time*.

---

## 2. Gap Analysis & Sisa Pekerjaan (Next Steps)

Meskipun modul laporan Gantt sudah sangat matang, masih ada beberapa fitur yang perlu diselesaikan untuk rilis final:

1. **Dinamisasi Perhitungan Resource & Material:** Saat ini modul `v_resource_plan` dan `v_material_plan` masih menarik data statis dari database. **Perlu diimplementasikan fungsi di frontend** untuk mengalikan `Total Kebutuhan` dengan proporsi `sisa_vol / volume`, lalu membaginya dengan `sisa durasi` aktual (hari ini s.d tanggal selesai).
2. **Authentication & RBAC:** Menerapkan Login/Register (Supabase Auth) dan pembatasan hak akses (Owner, PM, Site Admin).
3. **Audit Logs:** Mencatat setiap perubahan data (siapa, kapan, dan apa yang diubah).

---

## 3. Panduan Developer Selanjutnya (SANGAT PENTING)

### ⚠️ Protokol Keamanan Data (Zero Data Loss)
> **PENTING:** Semua perbaikan layout, EVM, dan Gantt Chart yang dilakukan di *frontend* (React) murni bersifat **Read & Compute**. Tidak ada query `UPDATE`, `DELETE`, atau perubahan skema pada tabel `wbs_tasks`, `v_resource_plan`, maupun `v_material_plan`. 
> **JANGAN MENGUBAH DATA DI DATABASE** hanya untuk memperbaiki tampilan. Semua kalkulasi harus dilakukan di sisi React.

### A. Workflow Git & Deployment (via PowerShell)
Setiap kali melakukan perbaikan, ikuti alur standar berikut dari terminal PowerShell (Windows):

```powershell
# 1. Pastikan dependensi aman (khusus jika menambah library baru)
npm install

# 2. Tambahkan perubahan
git add .

# 3. Commit dengan pesan yang jelas
git commit -m "Fix: [Jelaskan perbaikan yang dilakukan]"

# 4. Push ke GitHub (Vercel akan otomatis melakukan build & deploy)
git push origin main

B. Catatan Kritis PDF Engine (Puppeteer + Vercel)
Environment Vercel: File app/api/generate-pdf/route.js wajib menggunakan @sparticuz/chromium dan puppeteer-core. Jangan menggunakan puppeteer biasa karena akan gagal saat build di Vercel.

Environment Lokal (Windows): Jika ingin mencetak PDF di lokal, Anda bisa mengomentari blok @sparticuz/chromium dan mengaktifkan blok executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'.

CSS Cetak: Seluruh CSS di dalam pdfStyles (di page.jsx) wajib menggunakan Vanilla CSS. Jangan gunakan Tailwind di area #print-section karena Puppeteer tidak akan membacanya dengan benar.

C. Catatan Database (Supabase/PostgreSQL)
View SQL: JANGAN mengubah logika GROUP BY pada View SQL tanpa melakukan Drop View terlebih dahulu.

Reload Schema: Selalu jalankan perintah berikut di SQL Editor Supabase setelah mengubah View/Trigger agar API Supabase mengenali perubahan:

sql
NOTIFY pgrst, 'reload schema';
4. Akses & Kontak
Platform	Link / Tautan
Vercel Dashboard	[Link Vercel]
Supabase Dashboard	[Link Supabase]
Repository GitHub	[Link GitHub]
Dokumen ini dibuat untuk memastikan kelangsungan pengembangan proyek secara profesional dan aman.

text

### Apa selanjutnya?
File `HANDOFF.md` sudah aman dan terupdate. Sekarang Anda bisa fokus mengerjakan **Gap Analysis No. 1** (Dinamisasi Perhitungan Resource & Material) menggunakan kode yang saya berikan di jawaban sebelumnya, lalu lakukan `git push` kembali.