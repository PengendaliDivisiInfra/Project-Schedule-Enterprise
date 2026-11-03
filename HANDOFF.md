# Project Handoff Document - InfraControl PRO

**Status Proyek:** ?? Production Ready (V19 - Enterprise Finance, Approval Workflow & S-Curve)
**Terakhir Diperbarui:** 03 November 2026
**Developer Utama:** [Nama Anda]

---

## 1. Status Saat Ini (Implemented Features)
Aplikasi **InfraControl PRO** kini telah bertransformasi menjadi platform ERP Konstruksi kelas Enterprise. Sistem telah terintegrasi secara otomatis (*Waterfall Recalculation*) dari Master Harga hingga Realisasi Anggaran, dilengkapi dengan *Approval Workflow* dan *Executive Dashboard*.

### Fitur Utama yang Sudah Selesai (V19 Updates):
- **Enterprise Financial Sync & Cost Control:**
  - **Smart Delta Approach:** Memisahkan `cost` (Pagu RAP) dan `realisasi_cost` (Aktual). Pemotongan anggaran aman untuk *baseline* Kurva-S.
  - **Hierarchical Cost Rollup (v_cost_control_wbs):** View database yang otomatis menjumlahkan (rollup) pagu & realisasi dari sub-task ke baris induk, dilengkapi `DISTINCT ON` untuk mencegah duplikasi.
  - **Auto-Deduct & Reversal Trigger:** Transaksi Kas Keluar berstatus *Approved* memotong `realisasi_cost`. Jika dihapus/diedit, anggaran kembali presisi.
- **Approval Workflow Engine (Segregation of Duties):**
  - **Dasbor Persetujuan PM (`/approvals`):** Halaman eksklusif Project Manager untuk meninjau pengajuan kas lapangan.
  - **Rejection Reason Modal:** PM diwajibkan mengisi alasan penolakan (Audit Trail), statusnya langsung tersinkronisasi ke halaman Ledger tim lapangan (menjadi `REJECTED` berwarna merah).
- **S-Curve Cost Chart (`/s-curve`):**
  - Visualisasi kumulatif Rencana (Plan) vs Aktual (Realisasi) per bulan menggunakan `recharts` (ComposedChart).
  - Menggunakan View `v_s_curve_data` dengan *Window Function* `SUM() OVER()` dan filter *Case-Insensitive*.
- **Database Optimization:**
  - Penerapan *B-Tree Indexing* pada kolom tanggal (`start_date`, `transaction_date`) dan WBS code untuk performa query tingkat milidetik.
- **UI/UX Enterprise:**
  - Tab ganda di Finansial: **Riwayat Transaksi (Ledger)** dan **Kontrol Anggaran (Cost Control)**.
  - *Zebra striping* & *Bold* otomatis pada baris induk WBS di tabel Cost Control.

---

## 2. Gap Analysis (Apa yang BELUM Diimplementasikan)
1.  **Authentication & Role-Based Access Control (RBAC):** Belum ada Login. Saat ini siapa pun bisa mengakses halaman `/approvals`. Hak akses tombol Approve/Reject harus dibatasi.
2.  **Audit Logs:** Belum ada pencatatan otomatis *User ID* siapa yang mengubah/menyetujui data.

---

## 3. ?? ROADMAP PRIORITAS (Next Steps)

### Fase 6: Autentikasi & Otorisasi (Login/RBAC) - *SEDANG DIBAHAS*
*Tujuan: Mengamankan aplikasi sebelum rilis komersial.*
**Langkah Eksekusi (Rencana):**
1. Implementasikan `supabase.auth.signInWithPassword`.
2. Buat halaman `/login` dengan desain elegan.
3. Buat tabel `profiles` untuk menyimpan role user (Owner, PM, Site Admin).
4. Terapkan Next.js Middleware untuk memblokir akses tanpa sesi.
5. Aktifkan RLS Policy (Row Level Security) pada seluruh tabel database.

---

## 4. Panduan Developer Selanjutnya
- **Build:** `npm run build`
- **Deploy:** `git push origin main` (Otomatis via Vercel).
- **Catatan Penting:**
  - **JANGAN** menambahkan `UPDATE` manual pada tabel `wbs_tasks.cost`. Biarkan Trigger yang bekerja.
  - Selalu jalankan `NOTIFY pgrst, 'reload schema';` setelah ada perubahan struktur database.
  - Bucket `evidence` di Supabase Storage bersifat Public.

## 5. Akses & Kontak
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository GitHub:** [Link GitHub]