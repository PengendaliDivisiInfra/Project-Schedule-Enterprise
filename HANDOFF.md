Project Handoff Document - InfraControl PRO
Status Proyek: 🚀 Production Ready (V29 - Enterprise RBAC, Finance & Supply Chain)
Terakhir Diperbarui: 08 November 2026
Developer Utama: [Nama Anda]
Environment Setup: Windows PowerShell (Local), Vercel (Frontend), Railway (PDF Microservice), Supabase (Database)

1. Status Saat Ini (Implemented Features)
Aplikasi InfraControl PRO telah bertransformasi dari sekadar Project Scheduler menjadi Sistem ERP Konstruksi Terpadu.

A. Modul Resource Plan (Selesai 100%)
Master Komposisi Tim: Database master_crew_compositions untuk mendefinisikan kapasitas dan biaya per tim.

Sinkronisasi Biaya (AHSP): Kalkulasi harga otomatis menarik daily_rate dari project_resources dan harga_dasar dari master_hsd.

Resource Histogram (S-Curve): Visualisasi beban kerja tim dengan Limit Line dinamis dan Masking Harga (jika user tidak punya akses).

Auto-Leveling (Fase 3): Fitur cerdas yang memindai Peak Day (lonjakan merah) dan memberikan rekomendasi pergeseran jadwal (reschedule) otomatis ke database.

B. Modul Material Plan (Selesai 100%)
Inventory & Stok Gudang: Tabel inventory_materials dan inventory_transactions (Trigger auto-update stok).

Net Requirement: Tabel Requirement Plan secara cerdas memotong kebutuhan total dengan stok gudang on-hand.

Vendor Management: CRUD Supplier lengkap dengan info rekening bank.

Purchase Order (PO): Pembuatan PO, kalkulasi PPN/PPh otomatis, dan pengaturan No. PO manual/auto.

Goods Receipt (Parsial): Penerimaan barang bertahap. Stok otomatis masuk gudang, status PO berubah dari Ordered -> Partial -> Completed.

C. Modul Cash Flow & Finance (Selesai 100%)
Integrasi PO ke Kas: Menekan tombol "Bayar" pada PO otomatis mencatat Pengeluaran (Cash Out) ke tabel cash_flows.

Auto-Approve: Transaksi dari PO yang ditekan oleh Owner/PM langsung berstatus APPROVED.

Reversing Journal (Void Payment): Fitur pembatalan pembayaran PO. Sistem TIDAK menghapus data, melainkan membuat Jurnal Pembalik (Uang Masuk) untuk menjaga Audit Trail tetap 100% akurat.

D. Modul Security & RBAC (Selesai 100%)
Multi-Tenant Isolation (RLS): User hanya bisa melihat data (Proyek, PO, Kas) dari proyek yang dia ikuti.

Role-Based Access Control (RBAC):

Owner: Akses penuh.

Project Manager: Akses operasional & finansial (kecuali hapus data permanen).

Site Admin & DCC/Logistic: Bisa buat PO, tapi Harga disembunyikan (Rp ***).

QC & HSE: Hanya bisa melihat (Read-Only).

Centralized Permission: Semua aturan hak akses terpusat di lib/config/permissions.ts.

2. 🛑 LESSONS LEARNED (Larangan & Keharusan Mutlak)
Bagian ini adalah hasil evaluasi dari bug dan revisi yang terjadi selama pengembangan. Wajib dibaca dan dipatuhi oleh developer selanjutnya.

🚫 LARANGAN (DON'TS)
JANGAN menggunakan alert(), confirm(), atau prompt() bawaan browser. Selalu gunakan komponen Custom Toast (state toast) dan Custom Modal (seperti pada PurchaseOrderManager.tsx).

JANGAN melakukan Hard Delete (DELETE) pada data finansial (seperti cash_flows). Gunakan metode Reversing Journal (membuat entri baru sebagai pembalik) atau Soft Delete (is_active = false).

JANGAN menulis logika hak akses secara manual di dalam komponen (misal: if (role === 'Owner')). Selalu gunakan hook useRole() dan panggil fungsi can('PERMISSION_KEY').

JANGAN menggunakan SELECT * pada View yang kompleks di Supabase jika tidak yakin dengan tipenya. Selalu definisikan type casting eksplisit (misal: ::numeric(15,2)) saat membuat View SQL.

JANGAN melakukan git push jika npm run build masih merah (error TypeScript). Vercel akan gagal deploy.

JANGAN mengubah nama kolom di Supabase tanpa melakukan find & replace di Frontend. (Lihat daftar kolom di bawah).

✅ KEHARUSAN (DO'S)
SELALU sinkronkan nama Role di database dengan file lib/config/permissions.ts. (Gunakan Case-Insensitive check untuk berjaga-jaga).

SELALU gunakan FORMAT DESIMAL INDONESIA (koma) untuk tampilan UI, dan gunakan fungsi .toFixed(1).replace('.', ',') atau Intl.NumberFormat('id-ID').

SELALU sembunyikan/masking elemen harga (Rp ***) jika user login sebagai Site Admin atau DCC/Logistic (Gunakan can('VIEW_PRICE')).

SELALU pastikan Row Level Security (RLS) di Supabase mengizinkan operasi INSERT dan UPDATE untuk tabel yang baru diintegrasikan (seperti cash_flows). Cek Console Browser jika mendapat error 403 Forbidden.

SELALU buat Custom Modal Confirmation setiap kali akan melakukan aksi destruktif (Hapus PO, Batalkan Pembayaran).

SELALU sertakan tooltip (icon HelpCircle) pada header tabel yang berisi kalkulasi rumit agar transparan bagi Auditor.

3. Skema Database Krusial (Jangan Diubah!)
v_resource_requirements: total_requirement, daily_requirement, unit, daily_cost, capacity_per_day.

task_material_requirements: volume_requirement, waste_factor, actual_requirement.

master_hsd: harga_dasar, nama_item, satuan.

purchase_orders: po_number, status, payment_status, grand_total, ppn_amount, pph_amount.

cash_flows: project_id, type, category, amount, approval_status (Nilai valid: 'Approved', 'Pending', 'Rejected'), reference_id.

project_members: project_id, user_id, role (Nilai valid: 'Project Manager', 'Site Admin', 'DCC/Logistic', dll).

4. Roadmap Tersisa (Next Steps)
Tinggal 2 modul pamungkas untuk menyempurnakan aplikasi:

A. Audit Logs (Prioritas 1)
□ Membuat tabel audit_logs (id, user_id, action, table_name, record_id, old_data, new_data, created_at).
□ Membuat Trigger di Supabase untuk mencatat setiap UPDATE dan DELETE pada tabel purchase_orders dan cash_flows.
□ Membuat UI halaman /logs untuk melihat riwayat perubahan.
B. Alert System (Prioritas 2)
□ Integrasi dengan API pihak ketiga (seperti Fonnte untuk WA atau Resend untuk Email).
□ Kirim notifikasi otomatis ke PM jika sisa_hari < 14 pada Material Requirement.
□ Kirim notifikasi ke Owner jika ada pengajuan cash_flows dengan status Pending Overbudget.
5. Workflow Git & Deployment (via PowerShell)
Setiap kali melakukan perbaikan, ikuti alur standar berikut:

powershell
# 1. Pastikan build lokal hijau (WAJIB!)
npm run build

# 2. Tambahkan perubahan
git add .

# 3. Commit dengan pesan yang jelas
git commit -m "Fix/Feat: [Jelaskan perbaikan yang dilakukan]"

# 4. Push ke GitHub (Vercel akan otomatis melakukan build & deploy)
git push origin main
6. Akses & Kontak
Vercel (Frontend): [Link Vercel]

Railway (PDF Server): [Link Railway]

Supabase (DB): [Link Supabase]

Repository GitHub: [Link GitHub]

Dokumen ini dibuat untuk memastikan kelangsungan pengembangan proyek secara profesional, aman, dan mempertahankan standar Enterprise yang telah dibangun.