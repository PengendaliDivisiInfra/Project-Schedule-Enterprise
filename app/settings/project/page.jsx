'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useProject } from '../../../context/ProjectContext';
import { Save, Loader2, Building2, FileText, Calendar, ShieldCheck } from 'lucide-react';

export default function ProjectSettingsPage() {
  const { activeProjectId } = useProject();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const fetchProject = async () => {
      if (!activeProjectId) return;
      setLoading(true);
      const { data } = await supabase.from('projects').select('*').eq('id', activeProjectId).maybeSingle();
      if (data) setFormData(data);
      setLoading(false);
    };
    fetchProject();
  }, [activeProjectId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const { error } = await supabase.from('projects').update(formData).eq('id', activeProjectId);
    if (!error) {
      alert('Pengaturan Proyek berhasil disimpan!');
    } else {
      alert('Gagal menyimpan: ' + error.message);
    }
    setIsSaving(false);
  };

  if (!activeProjectId) return <div className="p-10 text-center text-slate-500 font-bold">Silakan pilih proyek terlebih dahulu di menu Manajemen Proyek.</div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Building2 className="text-indigo-600" /> Pengaturan Proyek (Standar PUPR)</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola informasi legalitas, administrasi, dan pihak-pihak yang terlibat dalam proyek.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Informasi Dasar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2"><FileText size={18} className="text-slate-600"/> <h2 className="font-bold text-slate-800">Informasi Utama</h2></div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-600 mb-1">Nama Proyek</label><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Lokasi</label><input type="text" name="location" value={formData.location || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Pemberi Tugas (Owner)</label><input type="text" name="owner_name" value={formData.owner_name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: Kementerian PUPR" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Perusahaan (Kontraktor)</label><input type="text" name="company_name" value={formData.company_name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Konsultan Pengawas</label><input type="text" name="consultant_name" value={formData.consultant_name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            </div>
          </div>

          {/* Legalitas & Kontrak */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2"><ShieldCheck size={18} className="text-slate-600"/> <h2 className="font-bold text-slate-800">Legalitas & Kontrak</h2></div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nomor Kontrak</label><input type="text" name="contract_number" value={formData.contract_number || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Kontrak</label><input type="date" name="contract_date" value={formData.contract_date || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nomor SPMK</label><input type="text" name="spmk_number" value={formData.spmk_number || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal SPMK</label><input type="date" name="spmk_date" value={formData.spmk_date || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Berakhir (PHO)</label><input type="date" name="end_date" value={formData.end_date || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            </div>
          </div>

          {/* Addendum */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2"><Calendar size={18} className="text-slate-600"/> <h2 className="font-bold text-slate-800">Addendum (Jika Ada)</h2></div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nomor Addendum</label><input type="text" name="addendum_number" value={formData.addendum_number || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Addendum</label><input type="date" name="addendum_date" value={formData.addendum_date || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2">
              {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Simpan Pengaturan
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}