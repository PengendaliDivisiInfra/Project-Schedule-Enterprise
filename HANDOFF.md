Project Handoff Document - InfraControl PRO
Status Proyek: 🚀 Production Ready (V32 - Enterprise RBAC, Finance, Subcontractor, BAOP, BAPP, BPUTK & Kasbon Engine)
Terakhir Diperbarui: 08 November 2026
Developer Utama: [Nama Anda]
Environment Setup: Windows PowerShell (Local), Vercel (Frontend), Railway (PDF Microservice), Supabase (Database)

1. Status Saat Ini (Implemented Features)
Aplikasi InfraControl PRO telah bertransformasi menjadi Sistem ERP Konstruksi Terpadu dengan standar akuntansi SAK ETAP Bab 23 dan kepatuhan perpajakan Indonesia (PPh 4(2) & PPN).

A. Modul Resource Plan, Material Plan, & Finance (Selesai)
Histogram S-Curve, Kalkulasi AHSP, Net Requirement, PO (PPN/PPh), Goods Receipt.

Auto-Approve, Reversing Journal (Void Payment), integrasi PO ke Kas.

B. Modul Termin / Cash In (Selesai)
Multi-tenant isolation (RLS), RBAC terpusat.

Sinkronisasi otomatis dengan Master Proyek dan Cash Flow (Ledger Kas Masuk).

C. Modul Document & Photo Vault (Selesai)
Penyimpanan dokumen legal dan foto progress terpusat (Supabase Storage) dengan Signed URLs.

D. Modul Subcontractor Management (Selesai)
Manajemen Vendor, SPK (RAB), dan Addendum (CCO) otomatis.

Mesin Kalkulasi SAK & KUP (lib/utils/sak-calculator.ts) untuk auto-audit.

Audit Trail System (audit_logs) mencatat semua perubahan data.

E. Modul Cetak BAOP & BAPP (Selesai)
BAOP: Layout A4 Portrait, Kop Surat dinamis, format list tanpa garis tabel, fitur Terbilang otomatis.

BAPP: Layout A4 Landscape, kalkulasi live (SAK/KUP), 6 kolom tanda tangan.

Print Engine: Menggunakan Puppeteer dengan injeksi Pure CSS/Inline Style (100% presisi).

F. Modul Cetak BPUTK - Biaya Pembayaran Upah Tenaga Kerja (Selesai - V32 Baru!)
Inline Edit Progress: Input volume "Periode Saat Ini" langsung di tabel dengan real-time calculation (Bruto, PPh, PPN, Retensi, Netto).

Soft Validation: Peringatan visual (border merah) jika input volume melebihi sisa kontrak, tanpa memblokir input (mengakomodasi kondisi lapangan).

Overlap Date Checker: Custom Modal peringatan jika terjadi tumpang tindih tanggal opname sebelum menyimpan (Upsert Logic).

Print Engine: Layout A3 Landscape presisi, mencegah double rendering antara UI dan PDF.

Riwayat BPUTK: Tersimpan di bputk_documents dengan fitur Cetak Ulang (Read-Only Mode).

G. Modul Pengajuan Kasbon (Selesai - V32 Baru!)
Dedicated Tab: Memisahkan fitur "Pengajuan Kasbon" dari "Pencairan Opname" (Clean Architecture).

Formulir Pengajuan: Desain UI/UX kelas Enterprise (A4 Landscape) dengan Kop Surat dinamis, border hijau, dan tata letak simetris.

Terbilang Engine: Fungsi Terbilang yang telah diperbaiki (anti "Nol Ribu") untuk nominal Rupiah.

Workflow Status: Pengajuan masuk ke database dengan status default Pending (tidak langsung memotong Cash Flow sebelum disetujui).

Riwayat Global: Menampilkan seluruh riwayat pengajuan kasbon proyek beserta status persetujuannya.

2. 🛑 LESSONS LEARNED (Larangan & Keharusan Mutlak)
PENTING: Kegagalan mematuhi aturan ini akan merusak stabilitas aplikasi.

UI/UX: DILARANG KERAS menggunakan alert(), confirm(), atau prompt() bawaan browser. Selalu gunakan Custom Modal Confirmation (seperti pada hapus BAOP/BAPP atau tumpang tindih BPUTK).

Keuangan: DILARANG melakukan Hard Delete pada data finansial (Kas, Jurnal). Gunakan Soft Delete atau Reversing Journal. (Pengecualian: Tabel riwayat cetak seperti baop_documents, bapp_documents, bputk_documents diperbolehkan Hard Delete).

Akses & Keamanan: DILARANG menulis logika RBAC manual di UI. Gunakan useRole() dan can('PERMISSION_KEY').

Print Engine (Puppeteer):

DILARANG menggunakan class Tailwind di dalam area cetak (id="print-area"). WAJIB menggunakan Pure CSS/Inline Style.

DILARANG membiarkan container PDF meluap. Gunakan height absolut (misal 155mm) dan margin-top: auto pada area tanda tangan agar dijamin 1 Halaman (No Page Break).

Pastikan id="print-area" hanya membungkus konten inti, jangan sertakan Kop Surat di UI Web ke dalam ID tersebut (Kop surat diinjeksi terpisah via string template API PDF).

Database:

DILARANG SELECT * pada View kompleks tanpa type casting eksplisit.

Pastikan RLS (Row Level Security) selalu di- update saat membuat tabel baru (bputk_documents, subcontractor_payments).

Perhatikan tipe kolom di Supabase (misal: kolom total yang bersifat Generated/Constraint) agar tidak terjadi error null value violates not-null constraint.

Lokalisasi: SELALU gunakan format desimal Indonesia (koma) dan helper MoneyText untuk masking harga.

3. Skema Database Krusial (Update V32)
Tabel Utama: projects, project_members, subcontractors, subcontractor_contracts, subcontractor_spk_items, subcon_opnames, subcon_financial_logs.

Tabel Pembayaran: subcontractor_payments (Kolom baru: status default 'Pending', category, payment_method).

Tabel Cetak (Dokumen): baop_documents, bapp_documents, bputk_documents.

Kolom Tambahan projects: contractor_pic_name, contractor_pic_title, contractor_address, logo_url, company_name.

4. Roadmap Tersisa (Next Steps)
Fokus utama selanjutnya adalah menyelesaikan modul pelaporan dan persetujuan:

A. Project Master Program (PMP) Print Engine (In Progress)

□ Membuat UI untuk mencetak tabel PMP - Resources (Crews).
□ Membuat UI untuk mencetak tabel PMP - Materials.
□ Integrasi ke data tasks (WBS), resources, dan materials.
B. Cetak Form GAS Lainnya

□ Invoice & Kwitansi Resmi (A4 Portrait).
C. Modul Approval Workflow (Finance/PM)

□ Membuat halaman persetujuan untuk mengubah status Kasbon/Opname dari Pending menjadi Approved atau Paid.
5. Workflow Git & Deployment
(Standar: npm run build Hijau -> git add . -> git commit -m "..." -> git push origin main)

Konfirmasi:
Handoff document telah diperbarui ke versi V32. Seluruh aturan terkait Print Engine (1 Halaman CSS murni), pemisahan UI/PDF, dan skema database baru (BPUTK & Kasbon) telah didokumentasikan secara komprehensif.