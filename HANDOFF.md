# Project Handoff Document - InfraControl PRO

**Status Proyek:** 🟢 Production Ready (V15 - Enterprise Project Controls)
**Terakhir Diperbarui:** 02 November 2026
**Developer Utama:** [Nama Anda]

---

## 1. Status Saat Ini (Implemented Features)
Aplikasi **InfraControl PRO** telah bertransformasi dari sekadar aplikasi manajemen proyek menjadi *Project Controls System* (setara Oracle Primavera P6 / MS Project). Seluruh kalkulasi berjalan secara dinamis (*real-time*) berdasarkan data AHSP dan Kalender Kerja.

### A. CPM Engine (Critical Path Method) - `lib/scheduler.js`
- **Full Forward & Backward Pass:** Menghitung ES (Early Start), EF (Early Finish), LS (Late Start), LF (Late Finish), Slack (Total Float), dan Critical Path.
- **Anti-Hang Protection:** Dilengkapi *safety counter* pada perulangan (while loop) untuk mencegah *browser freeze* (Infinite Loop) jika kalender kerja kosong/error.
- **Constraint Logic:** Mendukung ASAP, SNET, MSO, FNET, FNLT, MFO.
- **Predecessor Logic:** Mendukung FS, SS, FF, SF beserta Lag/Lead (+/-).
- **Auto-Sync Date:** Logika simbiosis segitiga (`Finish = Start + Duration - 1`) berjalan otomatis di UI saat tanggal atau durasi diubah.

### B. EVM (Earned Value Management) - `app/tasks/page.jsx`
- **Task Mode:** Pemisahan mutlak antara **Auto Scheduled** (dikontrol mesin CPM) dan **Manually Scheduled** (dikunci oleh user, CPM tidak boleh menimpa).
- **Smart Target (%):** Menghitung persentase rencana berdasarkan *Status Date* (hari ini) vs Tanggal Mulai/Selesai.
- **Volume Realisasi:** User menginput *Volume* (bukan persen). Sistem otomatis mengkonversi ke `Aktual (%)`.
- **Sisa Volume:** Kolom baru untuk melihat selisih antara Volume Total dengan Realisasi.
- **T/Hari (Target per Hari):** `(Sisa Volume) / (Sisa Hari)`. Dilengkapi indikator warna (Merah = Terlambat, Hijau/Biru = Aman/Cepat).
- **Inline Update & Optimistic UI:** Input volume realisasi langsung di tabel. Data tersimpan ke database di belakang layar tanpa me-reload halaman (0 ms loading).

### C. Resource & Material Management
- **Resource Histogram:** Menghitung Man-Hours (Tenaga) dan Machine-Hours (Alat) berdasarkan `(Volume x Koefisien x 8) / Durasi`. Dilengkapi *Crew Size* (jumlah pekerja fisik).
- **Material Requirement Plan:** Menghitung `(Volume x Koefisien) * (1 + Waste 5%)` dan *Delivery Rate* per minggu.
- **Unified Requirement Plan:** Penggabungan Tenaga, Alat, dan Bahan dalam satu UI Tabbed di halaman `/resources`.

### D. UI/UX Enterprise Grade
- **Task Information Modal:** Sistem Tab (General, Metadata, Predecessors, Help).
- **Interactive Predecessors:** Dropdown pilih task, pilih tipe hubungan, input lag. Tidak perlu hafal kode WBS.
- **Contextual Help:** Penjelasan dinamis di bawah form Predecessor sesuai tipe yang dipilih (FS/SS/FF/SF).
- **Toggle CPM Matrix:** Tombol untuk menyembunyikan/menampilkan kolom ES, EF, LS, LF, Slack di tabel untuk tampilan yang lebih ringkas.
- **Emoji-Free UI:** Ikon menggunakan Lucide React untuk mencegah *Encoding Bug* (`âŸ...`).

---

## 2. Struktur Database Kunci (Supabase)

- `projects`: Menyimpan kalender (`working_days`, `exceptions`) dan tanggal kontrak (`contract_start`, `contract_end`).
- `wbs_tasks`: Kolom kunci: `task_mode`, `task_type`, `constraint_type`, `constraint_date`, `start_date`, `end_date`, `duration`, `predecessors`, `progress_percent`.
- `task_assignments`: Alokasi Tenaga & Alat. Kolom kunci: `koefisien`, `allocation_pct`.
- `task_material_requirements`: Kalkulasi Bahan. Kolom kunci: `volume_requirement`, `waste_factor`, `actual_requirement`.
- `project_resources`: Master data Tenaga & Alat.
- `master_hsd` & `ahsp_details`: Master katalog AHSP.
- `v_resource_requirements`: View SQL (UNION ALL) untuk menggabungkan Tenaga, Alat, dan Bahan di halaman Requirement Plan.

### Triggers Penting di Database:
1. `trg_sync_contract_date`: Menggeser seluruh jadwal task (menggunakan `INTERVAL`) jika `contract_start` diubah. Dilengkapi *Rollup* untuk Parent Task.
2. `auto_generate_task_assignments`: Otomatis memasukkan Tenaga/Alat ke `task_assignments` dan Bahan ke `task_material_requirements` saat AHSP di-assign. (Menggunakan pencocokan `LOWER(TRIM(pr.role)) = LOWER(TRIM(h.nama_item))`).

### RLS (Row Level Security):
Pastikan tabel `task_assignments` dan `task_material_requirements` memiliki *Policy* `INSERT`, `UPDATE`, `DELETE` untuk `authenticated` users agar tidak terkena error "violates row-level security policy".

---

## 3. ⚠️ Catatan Penting Developer (LESSONS LEARNED)
1. **Timezone Bug:** JANGAN gunakan `date.toISOString().split('T')[0]`. Selalu gunakan helper `toDateStr()` di `scheduler.js` yang mengambil `.getFullYear()`, `.getMonth()`, `.getDate()` lokal.
2. **Date Snap-Back Bug:** Jika tanggal dikembalikan oleh sistem padahal di-edit, pastikan:
   - Task Mode di-set `Manually Scheduled`.
   - UI mengirim *Bulk Update* (tanggal, durasi, dan task_mode sekaligus) ke database.
   - CPM Engine tidak dijalankan untuk task manual.
3. **Encoding PowerShell:** Saat menggunakan PowerShell untuk *generate* file React, selalu gunakan `New-Object System.Text.UTF8Encoding($false)` (UTF-8 tanpa BOM). Jangan gunakan Emoji di JSX, gunakan ikon dari `lucide-react`.
4. **Data Anomali:** Jika grafik Histogram atau nilai T/Hari terlihat aneh (misal 853.500), periksa input `Volume` di database. Seringkali volumenya tidak logis dibandingkan durasinya.

---

## 4. 🚀 ROADMAP PRIORITAS (Next Steps)

Fase 1 (CPM, EVM, Resource, Material) telah **SELESAI 100%**. Berikut adalah sisa roadmap sesuai dokumen Action Plan:

### Fase 2: Risk Register & Mitigation (Manajemen Risiko)
*Tujuan: Proaktif terhadap ketidakpastian proyek.*
*   **Eksekusi:** Buat tabel `project_risks` (id, deskripsi, probabilitas, dampak, mitigasi, status). Buat halaman UI `/risks` dengan matriks 3x3.

### Fase 3: QA/QC & HSE Modules (Mutu & K3L)
*Tujuan: Standarisasi inspeksi lapangan dan keselamatan kerja.*
*   **Eksekusi:** Buat tabel `inspections` (checklist) dan `safety_reports`. Buat formulir digital (bisa diisi via HP).

### Fase 4: Cash Flow & Cost S-Curve (Keuangan)
*Tujuan: Memastikan likuiditas dana proyek.*
*   **Eksekusi:** Tambahkan grafik Kurva S Biaya di Dashboard yang membandingkan *Rencana Pengeluaran* (RAB) dengan *Realisasi*.

---

## 5. Panduan Build & Deploy
- **Build:** `npm run build`
- **Deploy:** `git push origin main` (Otomatis via Vercel).
- **Restart Server:** `Ctrl+C` lalu `npm run dev` (Wajib dilakukan setiap mengubah file di folder `lib/`).

## 6. Akses & Kontak
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository GitHub:** [Link GitHub]