# Project Handoff Document - InfraControl PRO

**Status Proyek:** 🟢 Production Ready (V27 - Enterprise PMP, Dynamic Gantt & Microservice PDF Engine)  
**Terakhir Diperbarui:** 06 November 2026  
**Developer Utama:** [Nama Anda]  
**Environment Setup:** Windows PowerShell (Local), Vercel (Frontend), Railway (PDF Microservice)

---

## 1. Status Saat Ini (Implemented Features)

Aplikasi **InfraControl PRO** telah melalui perombakan besar pada modul **Master Project Report (PMP)**. Sistem kini menggunakan arsitektur **Microservice** untuk pembuatan PDF guna menghindari batas *timeout* pada Vercel Serverless Functions.

### Fitur Utama yang Selesai (V27 Updates):

- **Single Source of Truth (EVM & CPM):**
  - Data `Target (%)`, `Varian (%)`, dan `T/hr` di halaman **Task Management** dan **Master Report** telah disinkronkan 100% menggunakan **Working Days** dan **CPM Engine** (`updateProjectScheduleSecure`).
  - Kalkulasi T/hr menggunakan rumus *Catch-up Plan* (Sisa Volume / Sisa Hari Kerja Efektif).
- **Desain Gantt Chart "Enterprise Bubble" (MS Project Style):**
  - Menggunakan bentuk kapsul (`border-radius: 999px`), gradien linear, dan tinggi bar yang proporsional (8px).
  - Tabel menggunakan kalkulasi lebar dinamis (`COL_WIDTH`) agar selalu memenuhi kertas A3 Landscape (*Full-Width*).
  - Garis *Dependency Arrows* (SVG) dihapus untuk mencegah bug layout saat dicetak.
- **PDF Microservice Architecture (Railway):**
  - Vercel Hobby memiliki batas maksimal eksekusi 10 detik, yang seringkali tidak cukup untuk merender Gantt Chart A3.
  - Solusi: Dibuat repositori terpisah (`pdf-service-repo`) berisi Express.js + Puppeteer + Dockerfile.
  - Server PDF di-*hosting* di **Railway.app** (bebas kartu kredit) dan diakses via API dari Next.js.

---

## 2. ⚠️ Catatan Penting Mengenai Railway (PDF Microservice Trial)

Karena kita menggunakan **Railway.app (Free Trial)** untuk server PDF, harap perhatikan poin-poin berikut agar sistem tetap terkontrol:

1. **Kredit Gratis $5.00:** 
   - Railway memberikan kredit $5.00 yang berlaku selama 30 hari. Pembuatan PDF memakan biaya sekitar $0.01 - $0.05 per cetak. Kredit ini cukup untuk ratusan kali cetak PDF.
   - **Pantau penggunaan** secara berkala di Dashboard Railway > Usage.
2. **Cold Start (Server Tidur):**
   - Jika server PDF tidak diakses selama beberapa jam, Railway akan mengubah statusnya menjadi *Idle/Sleep*.
   - Saat Anda menekan tombol "Cetak PDF" setelah server tidur, prosesnya akan memakan waktu **30-60 detik** karena Railway harus membangunkan server dan Chromium terlebih dahulu. **Ini normal.** Harap tunggu dengan sabar, jangan klik tombol berulang kali.
3. **Rencana Fallback (Jika Kredit Habis / Trial Berakhir):**
   - Jika masa trial 30 hari berakhir, Anda bisa memindahkan server PDF ke **Koyeb.com** (juga gratis dan tanpa kartu kredit) menggunakan `Dockerfile` yang sama persis.
   - Atau, *upgrade* ke akun Vercel Pro (batas *timeout* 60 detik) dan hapus API Microservice.

---

## 3. Gap Analysis & Sisa Pekerjaan (Next Steps)

Meskipun modul laporan Gantt sudah sangat matang, masih ada beberapa fitur yang perlu diselesaikan untuk rilis final:

1. **Dinamisasi Perhitungan Resource & Material:** Saat ini modul `v_resource_plan` dan `v_material_plan` masih menarik data statis dari database. Perlu diimplementasikan fungsi di frontend untuk mengalikan `Total Kebutuhan` dengan proporsi `sisa_vol / volume`.
2. **Authentication & RBAC:** Menerapkan Login/Register (Supabase Auth) dan pembatasan hak akses (Owner, PM, Site Admin).
3. **Audit Logs:** Mencatat setiap perubahan data (siapa, kapan, dan apa yang diubah).

---

## 4. Panduan Developer Selanjutnya (SANGAT PENTING)

### ⚠️ Protokol Keamanan Data (Zero Data Loss)
> **PENTING:** Semua perbaikan layout, EVM, dan Gantt Chart yang dilakukan di *frontend* (React) murni bersifat **Read & Compute**. Tidak ada query `UPDATE`, `DELETE`, atau perubahan skema pada tabel `wbs_tasks`, `v_resource_plan`, maupun `v_material_plan`. 
> **JANGAN MENGUBAH DATA DI DATABASE** hanya untuk memperbaiki tampilan. Semua kalkulasi harus dilakukan di sisi React.

### A. Workflow Git & Deployment (via PowerShell)
Setiap kali melakukan perbaikan, ikuti alur standar berikut dari terminal PowerShell (Windows):

```powershell
# 1. Pastikan tidak ada warning 'embedded git repository'
# Jika ada, hapus folder .git di dalam sub-folder (misal: pdf-service/.git)

# 2. Tambahkan perubahan
git add .

# 3. Commit dengan pesan yang jelas
git commit -m "Fix: [Jelaskan perbaikan yang dilakukan]"

# 4. Push ke GitHub (Vercel akan otomatis melakukan build & deploy)
git push origin main

B. Struktur Repositori
Frontend (Next.js): Di-hosting di Vercel.

PDF Microservice (Express + Puppeteer): Di-hosting di Railway. Folder pdf-service ada di dalam repositori ini, namun server Railway menggunakan repositori GitHub terpisah (pdf-service-repo) untuk deployment.

Database & Auth: Supabase (PostgreSQL).

C. Catatan Database (Supabase/PostgreSQL)
View SQL: JANGAN mengubah logika GROUP BY pada View SQL tanpa melakukan Drop View terlebih dahulu.

Reload Schema: Selalu jalankan perintah berikut di SQL Editor Supabase setelah mengubah View/Trigger agar API Supabase mengenali perubahan:

sql
NOTIFY pgrst, 'reload schema';
5. Akses & Kontak
Platform	Link / Tautan
Vercel (Frontend)	[Link Vercel]
Railway (PDF Server)	[Link Railway]
Supabase (DB)	[Link Supabase]
Repository GitHub	[Link GitHub]
Dokumen ini dibuat untuk memastikan kelangsungan pengembangan proyek secara profesional dan aman.