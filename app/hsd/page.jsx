'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AlertTriangle, Loader2, RefreshCw, Plus, Edit } from 'lucide-react';

export default function HsdPage() {
  const [hsdList, setHsdList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State Modal Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ tipe: 'Upah', kode: '', nama_item: '', satuan: 'Unit', harga_dasar: 0 });

  // State Modal Hapus
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State Toast
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchHsd = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    const { data, error } = await supabase.from('master_hsd').select('*').order('nama_item');
    if (data) setHsdList(data);
    
    if (isRefresh) setIsRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => { fetchHsd(); }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({ tipe: 'Upah', kode: '', nama_item: '', satuan: 'Unit', harga_dasar: 0 });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      tipe: item.tipe,
      kode: item.kode || '',
      nama_item: item.nama_item,
      satuan: item.satuan,
      harga_dasar: item.harga_dasar
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      tipe: formData.tipe,
      kode: formData.kode,
      nama_item: formData.nama_item,
      satuan: formData.satuan,
      harga_dasar: Number(formData.harga_dasar)
    };

    let errorMsg = null;

    if (editingItem) {
      const { error } = await supabase.from('master_hsd').update(payload).eq('id', editingItem.id);
      if (error) errorMsg = error.message;
      else showToast('success', 'Data HSD berhasil diperbarui!');
    } else {
      const { error } = await supabase.from('master_hsd').insert([payload]);
      if (error) errorMsg = error.message;
      else showToast('success', 'Data HSD berhasil ditambahkan!');
    }

    if (errorMsg) {
      alert("Gagal menyimpan: " + errorMsg);
    } else {
      setIsModalOpen(false);
      fetchHsd();
    }
    setIsSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const { error } = await supabase.from('master_hsd').delete().eq('id', deleteTarget.id);
    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      setDeleteTarget(null);
      showToast('danger', 'Data HSD berhasil dihapus.');
      fetchHsd();
    }
    setIsDeleting(false);
  };

  if (loading) return <LoadingSpinner text="Memuat Data HSD..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Harga Satuan Dasar (HSD)</h1>
            <p className="text-sm text-slate-500">Database induk Material, Upah, dan Alat.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => fetchHsd(true)} 
              disabled={isRefreshing}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> 
              {isRefreshing ? 'Memuat...' : 'Refresh'}
            </button>
            <button onClick={handleOpenAdd} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow transition-colors flex items-center gap-2">
              <Plus size={16} /> Tambah HSD Baru
            </button>
          </div>
        </div>

        {/* TABEL DATA */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Tipe</th>
                <th className="p-3">Kode</th>
                <th className="p-3">Nama Item</th>
                <th className="p-3">Satuan</th>
                <th className="p-3 text-right">Harga Dasar</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hsdList.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500 italic">Belum ada data HSD.</td>
                </tr>
              )}
              {hsdList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                  <td className="p-3">
                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                      item.tipe === 'Upah' ? 'bg-emerald-100 text-emerald-700' :
                      item.tipe === 'Bahan' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>{item.tipe}</span>
                  </td>
                  <td className="p-3 font-mono text-xs">{item.kode || '-'}</td>
                  <td className="p-3 font-semibold">{item.nama_item}</td>
                  <td className="p-3">{item.satuan}</td>
                  <td className="p-3 text-right font-bold">Rp {Number(item.harga_dasar).toLocaleString('id-ID')}</td>
                  <td className="p-3 text-center text-blue-600 font-medium text-xs whitespace-nowrap">
                    <button onClick={() => handleOpenEdit(item)} className="hover:underline flex items-center justify-center gap-1 w-full"><Edit size={14} /> Edit</button> | 
                    <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:underline ml-1">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ADD/EDIT HSD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">{editingItem ? '✏️ Edit Data HSD' : '📄 Tambah HSD Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipe</label>
                  <select value={formData.tipe} onChange={e => setFormData({...formData, tipe: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="Upah">Upah</option>
                    <option value="Bahan">Bahan</option>
                    <option value="Alat">Alat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kode HSD</label>
                  <input type="text" value={formData.kode} onChange={e => setFormData({...formData, kode: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="cth: L.01" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Item</label>
                <input required type="text" value={formData.nama_item} onChange={e => setFormData({...formData, nama_item: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Satuan</label>
                  <select value={formData.satuan} onChange={e => setFormData({...formData, satuan: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="Unit">Unit</option>
                    <option value="LS">LS (Lump Sum)</option>
                    <option value="M3">M3 (Kubik)</option>
                    <option value="M2">M2 (Persegi)</option>
                    <option value="Kg">Kg (Kilogram)</option>
                    <option value="Zak">Zak</option>
                    <option value="OH">OH (Orang Hari)</option>
                    <option value="Jam">Jam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Harga Dasar (Rp)</label>
                  <input required type="number" value={formData.harga_dasar} onChange={e => setFormData({...formData, harga_dasar: Number(e.target.value)})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" onFocus={(e) => e.target.select()} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HAPUS HSD */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus HSD Ini?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Anda akan menghapus <strong className="text-slate-800">{deleteTarget.nama_item}</strong>.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 w-full transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md w-full transition-colors flex items-center justify-center gap-2 disabled:bg-red-400">
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
