'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, ShieldCheck, CheckCircle2, UserCheck, Calendar, AlertTriangle, 
  Truck, Wallet, FileSignature, Boxes, ExternalLink 
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

export default function SOPPage() {
  const [activeTab, setActiveTab] = useState('prinsip');
  const { activeProjectId } = useProject();

  const tabs = [
    { id: 'prinsip', label: 'Prinsip Utama', icon: ShieldCheck },
    { id: 'peran', label: 'Peran & Tanggung Jawab', icon: UserCheck },
    { id: 'harian', label: 'Alur Kerja Harian', icon: Calendar },
    { id: 'bulanan', label: 'Cut-Off Bulanan', icon: CheckCircle2 },
    { id: 'checklist', label: 'Checklist Admin', icon: AlertTriangle },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
        <div className="p-4 bg-indigo-100 text-indigo-700 rounded-xl">
          <BookOpen size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">SOP & Panduan Alur Input Harian</h1>
          <p className="text-slate-500 mt-1">Standar Operasional Prosedur untuk menjamin akurasi Laporan Laba Rugi (PSAK 115) & Arus Kas (PSAK 207).</p>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div className="bg-white p-8 rounded-b-2xl rounded-tr-2xl shadow-sm border border-slate-200 min-h-[500px]">
        
        {activeTab === 'prinsip' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">1. Tujuan & Prinsip Utama</h2>
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-amber-900 rounded-r-lg">
              <p className="font-bold mb-2">Dua Aturan Emas (Golden Rules):</p>
              <ul className="list-disc ml-5 space-y-2">
                <li><strong>Biaya Proyek (Laba Rugi) ≠ Pembayaran Kas:</strong> Barang yang datang ke proyek (GRN) sudah dihitung sebagai Biaya meskipun belum dibayar. Sebaliknya, uang kasbon mandor belum dihitung sebagai biaya sebelum ada opname fisik.</li>
                <li><strong>Kode Akun & Kode Proyek Wajib Lengkap:</strong> Setiap transaksi wajib diikat pada proyek yang bersangkutan dan dipilih kategori biayanya (Material, Upah, Subkon, Alat, atau Site Overhead).</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'peran' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">2. Pembagian Peran (PIC)</h2>
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-3 border">Peran di Lapangan</th>
                  <th className="p-3 border">Modul ERP yang Diinput</th>
                  <th className="p-3 border">Dampak ke Laporan Keuangan</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-50"><td className="p-3 border font-bold">Cost Control / Site Engineer</td><td className="p-3 border">Pagu Anggaran (RAP) & Revisi RAP</td><td className="p-3 border">Menentukan penyebut rumus PoC (PSAK 115)</td></tr>
                <tr className="hover:bg-slate-50"><td className="p-3 border font-bold">Logistik / Gudang</td><td className="p-3 border">Penerimaan Barang (GRN) & Stock Opname</td><td className="p-3 border">Menentukan Biaya Material Terpasang (HPP)</td></tr>
                <tr className="hover:bg-slate-50"><td className="p-3 border font-bold">Quantity Surveyor (QS)</td><td className="p-3 border">Opname Mandor & Berita Acara Subkon (BAO)</td><td className="p-3 border">Mengakui Biaya Upah & Subkon secara akrual</td></tr>
                <tr className="hover:bg-slate-50"><td className="p-3 border font-bold">Site Admin / Kasir</td><td className="p-3 border">Kas Kecil, Bank Proyek, & Kasbon</td><td className="p-3 border">Mengisi Laporan Arus Kas dan saldo Kasbon/DP</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'harian' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">3. Alur Kerja Input Harian</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-xl p-5 bg-slate-50">
                <h3 className="font-bold text-indigo-700 mb-3">A. Alur Logistik (Material Datang)</h3>
                <ol className="list-decimal ml-5 space-y-2 text-sm text-slate-700">
                  <li>Logistik menerima barang & cek fisik dengan Surat Jalan.</li>
                  <li>Input <strong>Penerimaan Barang (GRN)</strong> di ERP (bukan PO).</li>
                  <li>Sistem otomatis menambah Actual Cost di P&L.</li>
                  <li>Material curah (ready mix/pasir) langsung diakui terpasang.</li>
                </ol>
              </div>
              <div className="border rounded-xl p-5 bg-slate-50">
                <h3 className="font-bold text-emerald-700 mb-3">B. Alur Keuangan (Pukul 16.00)</h3>
                <ol className="list-decimal ml-5 space-y-2 text-sm text-slate-700">
                  <li>Input nota kontan (konsumsi, ATK, BBM) ke <strong>Kas Keluar</strong>.</li>
                  <li>Input pemberian Kasbon Mandor ke menu <strong>Pengajuan Kasbon</strong>.</li>
                  <li>Input pelunasan faktur supplier ke menu <strong>Pembayaran Hutang</strong>.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bulanan' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">4. Alur Kerja Cut-Off Bulanan (Closing)</h2>
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
              <ol className="list-decimal ml-5 space-y-4 text-sm text-slate-700">
                <li><strong>Opname Mandor (QS):</strong> Input Berita Acara Opname (BAO). Sistem otomatis mengakui Biaya Upah dan memotong Kasbon.</li>
                <li><strong>Stock Opname Gudang (Logistik):</strong> Input sisa fisik material. Sistem otomatis mengurangi Actual Cost (Raw).</li>
                <li><strong>Akrual Tertunda (Admin):</strong> Input sewa alat/invoice yang belum tiba ke Jurnal Akrual.</li>
                <li><strong>Verifikasi Termin/SP2D (Admin):</strong> Cocokkan fisik uang brankas & rekening dengan Saldo Kas Akhir di Sistem.</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2">5. Checklist Harian Admin (Interactive)</h2>
            <p className="text-sm text-slate-500 mb-4">Centang dan ikuti tautan di bawah ini untuk memastikan tidak ada pekerjaan yang terlewat.</p>
            
            <div className="space-y-4">
              
              {/* ITEM 1: GRN */}
              <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors bg-white">
                <input type="checkbox" className="w-5 h-5 mt-1 text-indigo-600 rounded cursor-pointer" />
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2"><Truck size={18} className="text-indigo-600"/> Penerimaan Material (GRN)</h4>
                  <p className="text-sm text-slate-600 mt-1">Apakah ada Surat Jalan material yang datang hari ini?</p>
                  <div className="mt-2 text-xs text-indigo-700 bg-indigo-50 p-2 rounded border border-indigo-100 inline-block">
                    <strong>Cara Input:</strong> Buka menu <strong>Material</strong> &rarr; Tab <strong>Purchase Order</strong> &rarr; Klik tombol <strong>Terima Barang</strong> pada PO terkait.
                  </div>
                </div>
                <Link href="/materials" className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-200">
                  Ke Menu <ExternalLink size={12}/>
                </Link>
              </div>

              {/* ITEM 2: Kas Kecil */}
              <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors bg-white">
                <input type="checkbox" className="w-5 h-5 mt-1 text-indigo-600 rounded cursor-pointer" />
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2"><Wallet size={18} className="text-emerald-600"/> Kas Kecil / Petty Cash</h4>
                  <p className="text-sm text-slate-600 mt-1">Apakah semua nota kontan (BBM, konsumsi, ATK) sudah diinput?</p>
                  <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100 inline-block">
                    <strong>Cara Input:</strong> Buka menu <strong>Cash Flow</strong> &rarr; Klik <strong>+ Tambah Transaksi</strong> &rarr; Tipe: <strong>Kas Keluar</strong> &rarr; Pilih Kategori &rarr; Metode: <strong>Petty Cash / Tunai</strong>.
                  </div>
                </div>
                <Link href="/finances" className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-200">
                  Ke Menu <ExternalLink size={12}/>
                </Link>
              </div>

              {/* ITEM 3: Kasbon Mandor */}
              <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors bg-white">
                <input type="checkbox" className="w-5 h-5 mt-1 text-indigo-600 rounded cursor-pointer" />
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2"><FileSignature size={18} className="text-amber-600"/> Kasbon Mandor / DP Subkon</h4>
                  <p className="text-sm text-slate-600 mt-1">Apakah ada uang muka yang diberikan ke mandor hari ini?</p>
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 inline-block">
                    <strong>Cara Input:</strong> Buka menu <strong>Subcontractor</strong> &rarr; Tab <strong>Pengajuan Kasbon</strong>. Jangan input di menu Cash Flow agar tidak dihitung sebagai HPP.
                  </div>
                </div>
                <Link href={activeProjectId ? `/projects/${activeProjectId}/subcontractors` : '#'} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-amber-200">
                  Ke Menu <ExternalLink size={12}/>
                </Link>
              </div>

              {/* ITEM 4: Rekonsiliasi Kas */}
              <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors bg-white">
                <input type="checkbox" className="w-5 h-5 mt-1 text-indigo-600 rounded cursor-pointer" />
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2"><CheckCircle2 size={18} className="text-blue-600"/> Rekonsiliasi Saldo Kas</h4>
                  <p className="text-sm text-slate-600 mt-1">Apakah uang fisik di brankas sama dengan saldo akhir di sistem?</p>
                  <div className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-100 inline-block">
                    <strong>Cara Cek:</strong> Buka menu <strong>Cash Flow</strong> &rarr; Tab <strong>Laporan Arus Kas</strong>. Cocokkan baris <strong>SALDO KAS AKHIR PERIODE</strong> dengan fisik uang.
                  </div>
                </div>
                <Link href="/finances" className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-200">
                  Ke Menu <ExternalLink size={12}/>
                </Link>
              </div>

              {/* ITEM 5: Cut-Off Stok */}
              <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors bg-white">
                <input type="checkbox" className="w-5 h-5 mt-1 text-indigo-600 rounded cursor-pointer" />
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2"><Boxes size={18} className="text-rose-600"/> Stock Opname & Opname Subkon</h4>
                  <p className="text-sm text-slate-600 mt-1">Apakah ini akhir bulan? Pastikan stok dan progres subkon sudah diinput.</p>
                  <div className="mt-2 text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-100 inline-block">
                    <strong>Cara Input:</strong> Buka menu <strong>Material</strong> (untuk Stok) dan <strong>Subcontractor</strong> (untuk Opname). Ini wajib sebelum cetak Laporan P&L.
                  </div>
                </div>
                <Link href="/materials" className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-rose-200">
                  Ke Menu <ExternalLink size={12}/>
                </Link>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}