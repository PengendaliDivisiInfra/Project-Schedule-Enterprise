'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRole } from '@/lib/hooks/useRole';
import { coaService } from '@/lib/services/coa.service';
import { COA } from '@/lib/types/coa';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import COAModal from './COAModal'; 

export default function COAManagementView() {
  const { can } = useRole();
  const [coas, setCoas] = useState<COA[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoa, setEditingCoa] = useState<COA | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await coaService.getActiveCOAs();
      setCoas(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCoas = useMemo(() => {
    return coas.filter(c => {
      const matchSearch = c.nama_akun.toLowerCase().includes(search.toLowerCase()) || c.kode_akun.includes(search);
      const matchCategory = categoryFilter ? c.kategori_sak === categoryFilter : true;
      return matchSearch && matchCategory;
    });
  }, [coas, search, categoryFilter]);

  const handleSoftDelete = async () => {
    if (!deleteId) return;
    try {
      await coaService.softDeleteCOA(deleteId);
      await fetchData();
      setDeleteId(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (!can('MANAGE_COA')) return <div className="p-6 text-red-500 font-bold">Akses Ditolak. Anda tidak memiliki izin MANAGE_COA.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 border-b pb-2">
        <h1 className="text-xl font-bold text-blue-800">📘 MANAJEMEN KODE AKUN (CHART OF ACCOUNTS — SAK ETAP)</h1>
      </div>

      <div className="bg-blue-50 text-blue-800 p-4 rounded-md mb-6 text-sm">
        <p>💡 <strong>Cara Pakai:</strong> Kode akun di bawah ini otomatis dipakai oleh seluruh sistem (Buku Besar, Kartu Kendali, BPUTK, BAPP, Kwitansi).</p>
        <p>Format: XXXX = 4 digit utama • XXXX.YYY = akun per-mandor (suffix 001, 002, dst.)</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input 
          type="text" placeholder="🔍 Cari kode / nama..." 
          className="border rounded px-3 py-2 text-sm w-64"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select 
          className="border rounded px-3 py-2 text-sm"
          value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">-- Semua Kategori --</option>
          <option value="Aset Lancar">Aset Lancar</option>
          <option value="Aset Tetap">Aset Tetap</option>
          <option value="Liabilitas Jangka Pendek">Liabilitas Jangka Pendek</option>
          <option value="Liabilitas Jangka Panjang">Liabilitas Jangka Panjang</option>
          <option value="Ekuitas">Ekuitas</option>
          <option value="Pendapatan">Pendapatan</option>
          <option value="Beban Pokok Proyek">Beban Pokok Proyek</option>
          <option value="Beban Operasional">Beban Operasional</option>
        </select>
        
        <button onClick={() => { setEditingCoa(null); setIsFormOpen(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700">
          + Tambah Akun
        </button>
        <button onClick={fetchData} className="bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-600">
          ⟳ Muat Ulang
        </button>
      </div>

      <div className="text-sm text-gray-500 mb-2">
        Menampilkan {filteredCoas.length} akun aktif dari total {coas.length} akun.
      </div>

      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
            <tr>
              <th className="px-4 py-3">KODE</th>
              <th className="px-4 py-3">NAMA AKUN</th>
              <th className="px-4 py-3">KATEGORI SAK</th>
              <th className="px-4 py-3">SALDO</th>
              <th className="px-4 py-3">PER MANDOR</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-center">AKSI</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-4 text-gray-500">Memuat data...</td></tr>
            ) : filteredCoas.map((coa) => (
              <tr key={coa.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{coa.kode_akun}</td>
                <td className="px-4 py-2">{coa.nama_akun}</td>
                <td className="px-4 py-2 text-xs text-blue-700">
                  <span className="bg-blue-50 px-2 py-1 rounded-full">{coa.kategori_sak}</span>
                </td>
                <td className="px-4 py-2 text-xs font-semibold text-gray-600">{coa.saldo_normal}</td>
                <td className="px-4 py-2">
                  {coa.per_mandor ? (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">YA</span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-2 text-xs font-semibold text-gray-600">{coa.status}</td>
                <td className="px-4 py-2 text-center flex justify-center gap-2">
                  <button onClick={() => { setEditingCoa(coa); setIsFormOpen(true); }} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Edit</button>
                  <button onClick={() => setDeleteId(coa.id)} className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700">Hapus</button>
                </td>
              </tr>
            ))}
            {!loading && filteredCoas.length === 0 && (
              <tr><td colSpan={7} className="text-center py-4 text-gray-500">Tidak ada akun yang ditemukan.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <COAModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        initialData={editingCoa} 
        onSuccess={fetchData} 
      />

      <ConfirmModal 
        isOpen={!!deleteId}
        title="Hapus Akun"
        message="Apakah Anda yakin ingin menonaktifkan akun ini? Data historis tidak akan terhapus (Soft Delete)."
        onConfirm={handleSoftDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}