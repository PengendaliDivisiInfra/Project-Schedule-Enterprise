'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Plus, MapPin, Building2, Loader2, X, CheckCircle2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  
  const router = useRouter();
  const { selectProject } = useProject();

  const [formData, setFormData] = useState({ name: '', description: '', location: '' });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('project_members')
          .select(`role, projects (id, name, description, location)`)
          .eq('user_id', user.id);
        if (error) throw error;
        if (data) {
          const formatted = data.filter(i => i.projects).map(i => ({ ...i.projects, role: i.role }));
          setProjects(formatted);
        }
      }
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('projects').insert([{
      name: formData.name, description: formData.description, location: formData.location, owner_id: user.id
    }]);

    if (!error) {
      setIsModalOpen(false);
      setFormData({ name: '', description: '', location: '' });
      fetchProjects();
      showToast('success', 'Proyek berhasil dibuat!');
    } else {
      showToast('error', error.message);
    }
    setIsSaving(false);
  };

  const handleSelectProject = (proj) => {
    selectProject(proj.id, proj.role);
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
          <div className="h-24 bg-white rounded-2xl border border-slate-200 shadow-sm"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-white rounded-2xl border border-slate-200 shadow-sm"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-xl shadow-xl text-white font-bold animate-in slide-in-from-top-4 fade-in flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <CheckCircle2 size={18} /> {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 tracking-tight"><Building2 className="text-indigo-600" /> Manajemen Proyek</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">Pilih proyek untuk dikelola atau buat proyek baru.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2">
            <Plus size={18} /> Buat Proyek Baru
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">Belum Ada Proyek</h3>
            <p className="text-slate-500 text-sm mt-1 mb-4">Mulai dengan membuat proyek pertama Anda.</p>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
              + Tambah Proyek
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <div key={proj.id} onClick={() => handleSelectProject(proj)} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all group flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors text-indigo-600"><Building2 size={24} /></div>
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full uppercase border border-slate-200">{proj.role}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2 leading-tight">{proj.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-3 mb-4">{proj.description || 'Tidak ada deskripsi'}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium pt-4 border-t border-slate-100">
                  <MapPin size={16} className="text-rose-500" /> {proj.location || 'Lokasi belum diatur'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Building2 className="w-5 h-5 text-indigo-600"/> Buat Proyek Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white p-1.5 rounded-lg border border-slate-200 transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Proyek</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" placeholder="cth: Jembatan Mahakam" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Lokasi</label>
                <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" placeholder="cth: Kalimantan Timur" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Deskripsi</label>
                <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all disabled:bg-slate-400">
                  {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>} Simpan Proyek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}