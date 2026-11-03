# Project Handoff Document - InfraControl PRO

**Status Proyek:** 🟡 Under Development (V21 - Sprint 2: Multi-Tenancy & RBAC)
**Terakhir Diperbarui:** 03 November 2026
**Developer Utama:** [Nama Anda]

---

## 1. Status Saat Ini (Implemented Features)
Aplikasi **InfraControl PRO** sedang bertransisi dari aplikasi single-user menjadi SaaS Multi-Tenant.
- **Sprint 1 (SELESAI):** Autentikasi PKCE (Google SSO), Middleware Zero Trust, Manajemen Profil User (`public.profiles`).
- **Sprint 2 (BERJALAN):** Pembuatan struktur database Multi-Tenancy (`projects`, `project_members`), migrasi data lama ke proyek default.
- **Modul Fungsional (V19):** Finance (Smart Delta, Approval, S-Curve), QHSE, Risk Register, CPM.

---

## 2. 🚀 ROADMAP PRIORITAS (SEDANG BERJALAN)

### Fase 7: Multi-Tenancy & RBAC (Sprint 2)
*Tujuan: Memungkinkan PM mengelola banyak proyek dan mengundang anggota dengan hak akses terbatas.*
**Konsep & Arsitektur:**
1. **Tabel `projects`**: Menyimpan data proyek (Nama, Lokasi, Owner).
2. **Tabel `project_members`**: Menghubungkan User dengan Proyek dan Role (PM, DD, QC, HSE, Site Admin).
3. **Data Isolation**: Menggunakan `project_id` di semua tabel operasional (`wbs_tasks`, `cash_flows`, dll).
4. **Row Level Security (RLS)**: Mencegah PM A melihat data PM B.

**Langkah Eksekusi Tersisa:**
*   **[SEDANG BERJALAN]** Membuat UI Project Switcher di Sidebar (Dropdown untuk berpindah proyek).
*   Membuat Halaman `/projects` untuk melihat daftar proyek dan membuat proyek baru.
*   Membuat Halaman `/settings/team` untuk mengundang anggota (Invite via Email).
*   Menerapkan Aturan RLS (Row Level Security) di Supabase untuk tabel operasional.

---

## 3. Panduan Developer Selanjutnya
- **Build:** `npm run build`
- **Deploy:** `git push origin main` (Otomatis via Vercel).
- **Catatan Penting:**
  - **JANGAN** menambahkan `UPDATE` manual pada tabel `wbs_tasks.cost`. Biarkan Trigger yang bekerja.
  - Pastikan setiap user baru yang login (via Google/Email) memiliki data di `auth.users` dan `profiles`.
  - Selalu jalankan `NOTIFY pgrst, 'reload schema';` setelah ada perubahan struktur database.

## 4. Akses & Kontak
- **Vercel Dashboard:** [Link Vercel]
- **Supabase Dashboard:** [Link Supabase]
- **Repository GitHub:** [Link GitHub]