'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { AlertTriangle, Loader2, RefreshCw, Plus, Edit, X, Save, CheckCircle2, Search, Trash2 } from 'lucide-react';

export default function HsdPage() {
  const [hsdList, setHsdList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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
      tipe: item.tipe, kode: item.kode || '', nama_item: item.nama_item, satuan: item.satuan, harga_dasar: item.harga_dasar
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      tipe: formData.tipe, kode: formData.kode, nama_item: formData.nama_item, satuan: formData.satuan, harga_dasar: Number(formData.harga_dasar)
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
      // FIX: Menghapus alert(), ganti dengan Toast
      showToast('danger', "Gagal menyimpan: " + errorMsg);
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
      // FIX: Menghapus alert(), ganti dengan Toast
      showToast('danger', "Gagal menghapus: " + error.message);
    } else {
      setDeleteTarget(null);
      showToast('success', 'Data HSD berhasil dihapus.');
      fetchHsd();
    }
    setIsDeleting(false);
  };

  const filteredList = hsdList.filter(h => 
    h.nama_item?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    h.kode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <SkeletonLoader rows={10} cols={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-xl shadow-xl text-white font-bold animate-in slide-in-from-top-4 fade-in flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* HEADER & KONTROL */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 tracking-tight">Harga Satuan Dasar (HSD)</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">Database induk Material, Upah, dan Alat.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative group w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" placeholder="Cari item HSD..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium" 
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => fetchHsd(true)} disabled={isRefreshing} className="flex-1 sm:flex-none justify-center px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm">
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> 
                {isRefreshing ? 'Memuat...' : 'Refresh'}
              </button>
              <button onClick={handleOpenAdd} className="flex-1 sm:flex-none justify-center px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2">
                <Plus size={16} /> Tambah HSD
              </button>
            </div>
          </div>
        </div>

        {/* TABEL DATA */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-300">
                <tr className="text-slate-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 w-24 text-center">Tipe</th>
                  <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 w-28">Kode</th>
                  <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Nama Item</th>
                  <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 w-24 text-center">Satuan</th>
                  <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10 w-40">Harga Dasar</th>
                  <th className="p-4 font-bold border-b border-slate-300 text-center sticky top-0 bg-slate-50 z-10 w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-slate-400 font-medium italic">Belum ada data HSD yang sesuai.</td>
                  </tr>
                ) : filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors text-slate-700">
                    <td className="p-4 text-center">
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold uppercase tracking-wider ${
                        item.tipe === 'Upah' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        item.tipe === 'Bahan' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>{item.tipe}</span>
                    </td>
                    <td className="p-4 font-mono text-xs font-bold text-slate-500">{item.kode || '-'}</td>
                    <td className="p-4 font-bold text-slate-800">{item.nama_item}</td>
                    <td className="p-4 text-center font-medium">{item.satuan}</td>
                    <td className="p-4 text-right font-bold tabular-nums text-slate-700">Rp {Number(item.harga_dasar).toLocaleString('id-ID')}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleOpenEdit(item)} className="text-indigo-600 hover:text-indigo-800 p-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors" title="Edit Data">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(item)} className="text-rose-500 hover:text-rose-700 p-2 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors" title="Hapus Data">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL ADD/EDIT HSD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {editingItem ? <Edit className="text-indigo-600" size={20}/> : <Plus className="text-indigo-600" size={20}/>}
                {editingItem ? 'Edit Data HSD' : 'Tambah HSD Baru'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white p-1.5 rounded-lg border border-slate-200 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tipe</label>
                  <select value={formData.tipe} onChange={e => setFormData({...formData, tipe: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium">
                    <option value="Upah">Upah</option><option value="Bahan">Bahan</option><option value="Alat">Alat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kode HSD</label>
                  <input type="text" value={formData.kode} onChange={e => setFormData({...formData, kode: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono" placeholder="cth: L.01" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Item</label>
                <input required type="text" value={formData.nama_item} onChange={e => setFormData({...formData, nama_item: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Satuan</label>
                  <select value={formData.satuan} onChange={e => setFormData({...formData, satuan: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium">
                    <option value="Unit">Unit</option><option value="LS">LS</option><option value="M3">M3</option><option value="M2">M2</option><option value="M1">M1</option><option value="Kg">Kg</option><option value="Ton">Ton</option><option value="Zak">Zak</option><option value="Liter">Liter</option><option value="OH">OH</option><option value="Jam">Jam</option><option value="Hari">Hari</option><option value="Buah">Buah</option><option value="Set">Set</option><option value="Batang">Batang</option><option value="Lembar">Lembar</option><option value="Roll">Roll</option><option value="Titik">Titik</option><option value="Paket">Paket</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Harga Dasar (Rp)</label>
                  <input required type="number" value={formData.harga_dasar} onChange={e => setFormData({...formData, harga_dasar: Number(e.target.value)})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold tabular-nums" onFocus={(e) => e.target.select()} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16} /> Simpan Data</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HAPUS HSD */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 mb-4 border border-rose-200">
              <AlertTriangle className="h-8 w-8 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus HSD Ini?</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">
              Anda akan menghapus <strong className="text-slate-800">{deleteTarget.nama_item}</strong> dari database.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 w-full transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-5 py-2.5 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-md shadow-rose-500/20 w-full transition-colors flex items-center justify-center gap-2 disabled:bg-rose-400">
                {isDeleting ? <><Loader2 size={16} className="animate-spin" /> Menghapus...</> : <><Trash2 size={16} /> Ya, Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}