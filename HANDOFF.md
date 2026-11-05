# Project Handoff Document - InfraControl PRO

**Status Proyek:** 🟢 Production Ready (V28 - Enterprise PUPR Logic & Microservice PDF)  
**Terakhir Diperbarui:** 06 November 2026  
**Developer Utama:** [Nama Anda]  
**Environment Setup:** Windows PowerShell (Local), Vercel (Frontend), Railway (PDF Microservice)

---

## 1. Status Saat Ini (Implemented Features)

Aplikasi **InfraControl PRO** telah mencapai stabilitas penuh dengan implementasi logika **Enterprise PUPR** yang menyeluruh dan arsitektur **Microservice** untuk pembuatan PDF.

### Fitur Utama yang Selesai (V28 Updates):
- **Sinkronisasi Data Mutlak (Single Source of Truth):** Data `Target`, `Varian`, `T/hr` di Task Management, Gantt Chart, dan PDF Report 100% identik menggunakan *CPM Engine* & *Working Days*.
- **Dinamisasi Material (PUPR Standard):**
  - Menghitung *Sisa Kebutuhan Ideal* berdasarkan proporsi Sisa Volume.
  - Menghitung *Sisa Waste* secara dinamis.
  - Memberikan peringatan **Lead Time** (Warna Merah) jika Sisa Hari Pekerjaan < 14 Hari DAN Sisa Barang > 0.
- **Dinamisasi Resource (PUPR Standard):**
  - Menghitung *Target Vol/Hari* berdasarkan Sisa Volume dan Sisa Hari.
  - Menghitung **Jumlah Tim** (Kapasitas Nyata 10 unit/hari).
  - Memberikan **Rekomendasi Otomatis** (Lembur/Shift) jika jumlah tim > 2.
  - Menampilkan satuan (Jam, OH, Kg, M2, M3) secara dinamis.
- **Server-Side PDF Engine (Railway):** Pembuatan PDF (A3 Landscape) dengan Watermark "DRAFT/FINAL", Logo Perusahaan Dinamis (via Supabase Storage), dan Tanda Tangan 3 Kolom sejajar sempurna.

---

## 2. Catatan Penting Mengenai Railway (PDF Microservice Trial)

Sistem PDF berjalan di **Railway.app (Free Trial)**:
1. **Kredit Gratis:** $5.00. Cukup untuk ~500 kali cetak PDF.
2. **Cold Start:** Jika server tidur (idle), cetakan pertama memakan waktu 30-60 detik. Harap tunggu dan jangan klik berulang kali.
3. **Fallback:** Jika kredit habis, deploy `pdf-service-repo` ke **Koyeb.com** (gratis tanpa kartu kredit) menggunakan `Dockerfile` yang sama.

---

## 3. Gap Analysis & Sisa Pekerjaan

1. **Modul Inventory (Stok Gudang):** Saat ini *Stok On-Hand* di asumsikan 0. Perlu tabel baru di Supabase jika ingin sistem mengurangi kebutuhan pengadaan dengan stok fisik di gudang.
2. **Master Tim:** Perlu definisi baku berapa jumlah pekerja dalam 1 Tim (misal: 1 Mandor + 5 Pekerja) agar kalkulasi "Jumlah Tim" bisa dikonversi menjadi "Jumlah Pekerja".
3. **Authentication & RBAC:** Implementasi Login (Supabase Auth) sebelum *Go-Live*.
4. **Audit Logs:** Mencatat setiap perubahan data.

---

## 4. Panduan Developer Selanjutnya (SANGAT PENTING)

### ⚠️ Protokol Keamanan Data
> Semua kalkulasi Resource & Material dilakukan di *Frontend* (React) menggunakan data dari View Database. **JANGAN** mengubah struktur database tanpa melakukan *Drop View* terlebih dahulu.

### A. Workflow Git & Deployment (via PowerShell)
```powershell
git add .
git commit -m "Fix: [Jelaskan perbaikan]"
git push origin main

(Vercel akan otomatis build dan deploy)

B. Catatan Nama Kolom Database (Krusial)
Saat ini kode React memanggil data dengan nama kolom berikut:

Tabel v_resource_requirements: total_requirement, daily_requirement, unit.

Tabel task_material_requirements: volume_requirement, waste_factor, actual_requirement.

Tabel master_hsd: harga_dasar, nama_item, satuan.
Jangan mengubah nama kolom ini di database tanpa melakukan find & replace di kode Frontend.

5. Akses & Kontak
Platform	Link / Tautan
Vercel (Frontend)	[Link Vercel]
Railway (PDF Server)	[Link Railway]
Supabase (DB)	[Link Supabase]
Repository GitHub	[Link GitHub]
Dokumen ini dibuat untuk memastikan kelangsungan pengembangan proyek secara profesional dan aman.