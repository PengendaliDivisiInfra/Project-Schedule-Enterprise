# Project Handoff Document - InfraControl PRO

**Status Proyek:** 🟢 Production Ready (V28 - Enterprise PUPR Logic & Microservice PDF)  
**Terakhir Diperbarui:** 07 November 2026  
**Developer Utama:** [Nama Anda]  
**Environment Setup:** Windows PowerShell (Local), Vercel (Frontend), Railway (PDF Microservice)

---

## 1. Status Saat Ini (Implemented Features)

Aplikasi **InfraControl PRO** telah mencapai stabilitas penuh dengan implementasi logika **Enterprise PUPR** yang menyeluruh dan arsitektur **Microservice** untuk pembuatan PDF.

### Fitur Utama yang Selesai (V28 Updates):
- [x] **Sinkronisasi Data Mutlak (Single Source of Truth):** Data `Target`, `Varian`, `T/hr` di Task Management, Gantt Chart, dan PDF Report 100% identik menggunakan *CPM Engine* & *Working Days*.
- [x] **Dinamisasi Material (PUPR Standard):** Menghitung *Sisa Kebutuhan Ideal* berdasarkan proporsi Sisa Volume, *Sisa Waste* dinamis, dan peringatan **Lead Time** (Warna Merah) jika Sisa Hari < 14 Hari DAN Sisa Barang > 0.
- [x] **Dinamisasi Resource (PUPR Standard):** Menghitung *Target Vol/Hari*, **Jumlah Tim** (Kapasitas Nyata 10 unit/hari), **Rekomendasi Otomatis** (Lembur/Shift), dan menampilkan satuan (Jam, OH, Kg, M2, M3) secara dinamis.
- [x] **Server-Side PDF Engine (Railway):** Pembuatan PDF (A3 Landscape) dengan Watermark "DRAFT/FINAL", Logo Perusahaan Dinamis (via Supabase Storage), dan Tanda Tangan 3 Kolom sejajar sempurna.
- [x] **Gantt Chart "Enterprise Bubble":** Visualisasi bar kapsul (Pill Shape) dengan gradien, dinamis memenuhi kertas A3, dan tanpa SVG dependency lines yang berantakan.
- [x] **Security & RLS:** Supabase Row Level Security telah diaktifkan dan View SQL telah menggunakan `security_invoker`.

---

## 2. Roadmap & Gap Analysis (Rencana Pengembangan Selanjutnya)

Berikut adalah daftar fitur yang direncanakan untuk dikembangkan. Gunakan tanda centang `[x]` jika sudah selesai, dan biarkan kosong `[ ]` jika belum dikerjakan.

### A. Modul RESOURCE PLAN (Tenaga Kerja & Alat)
- [ ] **Kalkulasi Biaya Resource (Resource Cost):** Menambahkan kolom *"Estimasi Sisa Biaya"* (Sisa Kebutuhan x Biaya Harian) dan mengintegrasikannya ke Cash Flow.
- [ ] **Definisi Komposisi Tim (Crew Composition):** Membuat tabel master untuk mendefinisikan 1 Tim = Berapa Mandor, Tukang, dan Pekerja. Sehingga rekomendasi "Butuh 2 Tim" bisa diterjemahkan ke jumlah orang.
- [ ] **Resource Histogram (Grafik Beban Kerja):** Visualisasi grafik batang (S-Curve) untuk mendeteksi *Resource Over-allocation* (penumpukan tenaga kerja di hari tertentu).
- [ ] **Resource Leveling (Penyeimbangan):** Fitur otomatis untuk memundurkan/memecah tugas jika terjadi bentrok jadwal yang menyebabkan penumpukan tim.

### B. Modul MATERIAL PLAN
- [ ] **Modul Inventory / Stok Gudang (Prioritas Utama):** Membuat tabel `inventory_materials` untuk mencatat barang masuk/keluar. Saat ini *Stok On-Hand* di asumsikan 0. Dengan fitur ini, sistem akan memotong kebutuhan pengadaan dengan stok fisik.
- [ ] **Purchase Order (PO) & Procurement Tracking:** Fitur untuk membuat draft PO otomatis dari tabel Material Requirement dan memantau statusnya (Draft -> Approved -> Delivered).
- [ ] **Analisis Waste (Pemborosan) Aktual:** Membandingkan *Kebutuhan Ideal (AHSP)* vs *Total Barang yang Benar-benar Dibeli* untuk laporan evaluasi efisiensi lapangan.
- [ ] **Supplier & Vendor Management:** Database supplier per material (harga, lead time riil, rating performa) untuk merekomendasikan supplier terbaik saat Lead Time berwarna merah.

### C. Integrasi Lintas Modul (Enterprise Dashboard)
- [ ] **Alert System (Notifikasi):** Kirim notifikasi (WA/Email) otomatis ke Project Manager jika Status Lead Time Merah atau Rekomendasi Resource berubah menjadi "Shift".
- [ ] **Forecasting (Prakiraan):** Prediksi kapan proyek akan selesai berdasarkan kecepatan riil (Target Harian vs Kapasitas Nyata).
- [ ] **S-Curve Resource vs Progress:** Membandingkan kurva Progress Pekerjaan dengan kurva Penggunaan Tenaga Kerja.

### D. Keamanan & Administrasi
- [ ] **Authentication & RBAC:** Implementasi Login/Register (Supabase Auth) dan pembatasan hak akses (Owner, PM, Site Admin).
- [ ] **Audit Logs:** Mencatat setiap perubahan data (siapa, kapan, dan apa yang diubah) ke dalam tabel `audit_logs`.

---

## 3. ⚠️ Catatan Penting Untuk Developer Selanjutnya

### A. Protokol Keamanan Data (Zero Data Loss)
> **PENTING:** Semua perbaikan layout, EVM, Resource, dan Material yang dilakukan di *frontend* (React) murni bersifat **Read & Compute**. Tidak ada query `UPDATE`, `DELETE`, atau perubahan skema pada tabel `wbs_tasks`, `v_resource_plan`, maupun `v_material_plan`. 
> **JANGAN MENGUBAH DATA DI DATABASE** hanya untuk memperbaiki tampilan. Semua kalkulasi harus dilakukan di sisi React.

### B. Nama Kolom Database (Krusial)
Saat ini kode React memanggil data dengan nama kolom berikut. **Jangan mengubah nama kolom ini di Supabase** tanpa melakukan *find & replace* di kode Frontend:
- Tabel `v_resource_requirements`: `total_requirement`, `daily_requirement`, `unit`.
- Tabel `task_material_requirements`: `volume_requirement`, `waste_factor`, `actual_requirement`.
- Tabel `master_hsd`: `harga_dasar`, `nama_item`, `satuan`.

### C. Railway (PDF Microservice Trial)
- **Kredit Gratis:** $5.00 (berlaku 30 hari). Cukup untuk ~500 kali cetak PDF.
- **Cold Start:** Jika server tidur (idle), cetakan pertama memakan waktu 30-60 detik. Harap tunggu dengan sabar.
- **Fallback:** Jika kredit habis, deploy folder `pdf-service` ke **Koyeb.com** (gratis tanpa kartu kredit) menggunakan `Dockerfile` yang sama.

### D. Workflow Git & Deployment (via PowerShell)
Setiap kali melakukan perbaikan, ikuti alur standar berikut:
```powershell
# 1. Tambahkan perubahan
git add .

# 2. Commit dengan pesan yang jelas
git commit -m "Fix/Feat: [Jelaskan perbaikan yang dilakukan]"

# 3. Push ke GitHub (Vercel akan otomatis melakukan build & deploy)
git push origin main

### 4. Akses & Kontak
Platform	Link / Tautan
Vercel (Frontend)	[Link Vercel]
Railway (PDF Server)	[Link Railway]
Supabase (DB)	[Link Supabase]
Repository GitHub	[Link GitHub]
Dokumen ini dibuat untuk memastikan kelangsungan pengembangan proyek secara profesional dan aman.