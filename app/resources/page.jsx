'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Users, HardHat, Loader2, Plus, AlertTriangle } from 'lucide-react';

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [formData, setFormData] = useState({
    name: '', role: 'Tenaga Kerja', daily_rate: 0, avatar_url: ''
  });

  const fetchResources = async () => {
    setLoading(true);
    const { data } = await supabase.from('project_resources').select('*').order('name');
    if (data) setResources(data);
    setLoading(false);
  };

  useEffect(() => { fetchResources(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 300)); // UX Delay

    const { error } = await supabase.from('project_resources').insert([formData]);
    
    if (error) {
      alert("Gagal menyimpan: " + error.message);
    } else {
      setIsModalOpen(false);
      setFormData({ name: '', role: 'Tenaga Kerja', daily_rate: 0, avatar_url: '' });
      fetchResources();
    }
    setIsSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await supabase.from('project_resources').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    fetchResources();
  };

  if (loading) return <LoadingSpinner text="Memuat Data Resource..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Resource Management</h1>
            <p className="text-sm text-slate-500">Kelola Master Data Tenaga Kerja, Alat, dan Material.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-colors flex items-center gap-2">
            <Plus size={16} /> Tambah Resource
          </button>
        </div>

        {/* TABEL DATA */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Tipe</th>
                <th className="p-3">Nama Resource / Pekerja</th>
                <th className="p-3">Role / Jabatan</th>
                <th className="p-3 text-right">Biaya Harian (Rp)</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resources.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="font-bold text-slate-700">Belum Ada Data Resource</p>
                    <p className="text-sm text-slate-400 mt-1">Silakan tambahkan data tenaga kerja atau alat.</p>
                  </td>
                </tr>
              )}
              {resources.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                  <td className="p-3">
                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                      item.role.includes('Alat') ? 'bg-amber-100 text-amber-700' :
                      item.role.includes('Material') ? 'bg-blue-100 text-blue-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.role.includes('Alat') ? 'Alat' : item.role.includes('Material') ? 'Material' : 'Tenaga Kerja'}
                    </span>
                  </td>
                  <td className="p-3 font-semibold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                      {item.name.charAt(0)}
                    </div>
                    {item.name}
                  </td>
                  <td className="p-3">{item.role}</td>
                  <td className="p-3 text-right font-bold">Rp {Number(item.daily_rate).toLocaleString('id-ID')}</td>
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

      {/* MODAL TAMBAH RESOURCE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">👷 Tambah Resource Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap / Nama Alat</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipe / Role</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="Tenaga Kerja">Tenaga Kerja (Umum)</option>
                    <option value="Mandor">Mandor</option>
                    <option value="Site Engineer">Site Engineer</option>
                    <option value="Project Manager">Project Manager</option>
                    <option value="Alat Berat">Alat Berat</option>
                    <option value="Material">Material</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Biaya Harian (Rp)</label>
                  <input required type="number" value={formData.daily_rate} onChange={e => setFormData({...formData, daily_rate: Number(e.target.value)})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" onFocus={(e) => e.target.select()} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : 'Simpan Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Resource Ini?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Anda akan menghapus <strong className="text-slate-800">{deleteTarget.name}</strong>.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 w-full">Batal</button>
              <button onClick={handleDeleteConfirm} className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md w-full">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
