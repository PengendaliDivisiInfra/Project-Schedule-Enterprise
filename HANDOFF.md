# Project Handoff Document - InfraControl PRO

**Status Proyek:** ?? Under Development (V20 - Sprint 1: Authentication & RBAC)
**Terakhir Diperbarui:** 03 November 2026
**Developer Utama:** [Nama Anda]

---

## 1. Status Saat Ini (Implemented Features)
Aplikasi **InfraControl PRO** adalah platform ERP Konstruksi kelas Enterprise dengan otomasi finansial penuh dan pelaporan visual.
- **Finance & Cost Control (V19):** Smart Delta Trigger, Hierarchical Cost Rollup, S-Curve Chart.
- **Governance:** Approval Workflow dengan Rejection Reason.
- **S-Curve:** Visualisasi kumulatif Plan vs Actual berbasis Window Function.

---

## 2. ?? ROADMAP PRIORITAS (SEDANG BERJALAN)

### Fase 6: Autentikasi, Multi-Tenancy & RBAC (Enterprise SaaS)
*Tujuan: Mengubah aplikasi dari single-user statis menjadi SaaS Multi-Tenant yang aman.*
**Konsep & Arsitektur:**
1. **Segregation of Duties:** Role dibagi menjadi `Owner` (View), `PM` (Full Akses), `DD` (Cash Flow), `QC/HSE` (QHSE), `Site Admin` (Progress).
2. **Invitation Flow:** Tidak ada registrasi publik. PM mengundang staf via email. Staf membuat password sendiri.
3. **Data Isolation:** PM A tidak bisa melihat proyek PM B. (Menggunakan Row Level Security / RLS).

**Rencana Eksekusi Sprint:**
*   **[SEDANG BERJALAN] Sprint 1:** Setup Supabase Auth, pembuatan Tabel `profiles`, pembuatan Halaman `/login`, dan fungsi Logout.
*   **Sprint 2:** Migrasi data lama ke dalam tabel `projects`. Penambahan kolom `project_id` ke seluruh tabel operasional.
*   **Sprint 3:** Implementasi RLS (Data Isolation), Sidebar Dinamis (Hide menu by role), dan Fitur Invite Member via Email.

---

## 3. Panduan Developer Selanjutnya
- **Build:** `npm run build`
- **Deploy:** `git push origin main` (Otomatis via Vercel).
- **Catatan Penting:**
  - **JANGAN** menambahkan `UPDATE` manual pada tabel `wbs_tasks.cost`. Biarkan Trigger yang bekerja.
  - Pastikan Email Provider di Supabase Auth sudah diaktifkan (Email/Password).
  - Selalu jalankan `NOTIFY pgrst, 'reload schema';` setelah ada perubahan struktur database.

## 4. Akses & Kontak
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository GitHub:** [Link GitHub]