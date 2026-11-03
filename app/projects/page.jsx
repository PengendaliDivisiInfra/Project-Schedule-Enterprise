'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Plus, MapPin, Building2, Loader2, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { selectProject } = useProject();

  const [formData, setFormData] = useState({ name: '', description: '', location: '' });

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
      console.error(err);
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
    } else {
      alert(error.message);
    }
    setIsSaving(false);
  };

  const handleSelectProject = (proj) => {
    selectProject(proj.id, proj.role);
    router.push('/tasks');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Building2 className="text-indigo-600" /> Manajemen Proyek</h1>
            <p className="text-sm text-slate-500 mt-1">Pilih proyek untuk dikelola atau buat proyek baru.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2">
            <Plus size={18} /> Buat Proyek Baru
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <div key={proj.id} onClick={() => handleSelectProject(proj)} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors"><Building2 className="text-indigo-600" size={24} /></div>
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full uppercase">{proj.role}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{proj.name}</h3>
              <p className="text-xs text-slate-500 mb-4 line-clamp-2">{proj.description || 'Tidak ada deskripsi'}</p>
              <div className="flex items-center gap-2 text-sm text-slate-500"><MapPin size={16} /> {proj.location || 'Lokasi belum diatur'}</div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800">Buat Proyek Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Proyek</label><input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: Jembatan Mahakam" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Lokasi</label><input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: Kalimantan Timur" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Deskripsi</label><textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" /></div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2">
                  {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>} Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}