/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function HsdPage() {
  const [hsdList, setHsdList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Memindahkan fetchHsd ke dalam useEffect atau dibungkus dengan useCallback untuk menghindari warning
  useEffect(() => {
    const fetchHsdData = async () => {
      setLoading(true);
      const { data } = await supabase.from('master_hsd').select('*').order('nama_item');
      if (data) setHsdList(data);
      setLoading(false);
    };
    fetchHsdData();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const { error } = await supabase.from('master_hsd').delete().eq('id', deleteTarget.id);
    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      setDeleteTarget(null);
      // Fetch ulang data setelah hapus
      const { data } = await supabase.from('master_hsd').select('*').order('nama_item');
      if (data) setHsdList(data);
    }
    setIsDeleting(false);
  };

  if (loading) return <LoadingSpinner text="Memuat Data HSD..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Harga Satuan Dasar (HSD)</h1>
            <p className="text-sm text-slate-500">Database induk Material, Upah, dan Alat.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Refresh
            </button>
            <button className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow transition-colors">
              + Tambah HSD Baru
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Tipe</th>
                <th className="p-3">Kode</th>
                <th className="p-3">Nama Item</th>
                <th className="p-3">Satuan</th>
                <th className="p-3 text-right">Harga Dasar</th>
                <th className="p-3 text-center">Digunakan Pada (AHSP)</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hsdList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                  <td className="p-3">
                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                      item.tipe === 'Upah' ? 'bg-emerald-100 text-emerald-700' :
                      item.tipe === 'Bahan' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{item.tipe}</span>
                  </td>
                  <td className="p-3 font-mono text-xs">{item.kode || '-'}</td>
                  <td className="p-3 font-semibold">{item.nama_item}</td>
                  <td className="p-3">{item.satuan}</td>
                  <td className="p-3 text-right font-bold">Rp {Number(item.harga_dasar).toLocaleString('id-ID')}</td>
                  <td className="p-3 text-center text-xs italic text-slate-400">Belum digunakan</td>
                  <td className="p-3 text-center text-blue-600 font-medium text-xs whitespace-nowrap">
                    <button className="hover:underline">Edit</button> | 
                    <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:underline ml-1">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ENTERPRISE DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus HSD Ini?</h3>
            <p className="text-sm text-slate-500 mb-4">
              Anda akan menghapus <strong className="text-slate-800">{deleteTarget.nama_item}</strong>.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left flex items-start gap-2">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-amber-800 font-medium">
                Peringatan: Data di AHSP yang menggunakan HSD ini mungkin akan error atau berubah nilainya.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setDeleteTarget(null)} 
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 w-full transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={handleDeleteConfirm} 
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md w-full transition-colors flex items-center justify-center gap-2 disabled:bg-red-400"
              >
                {isDeleting ? <><Loader2 size={16} className="animate-spin" /> Menghapus...</> : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
