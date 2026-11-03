'use client';
import { Menu, Search, Bell, ChevronDown, UserCircle, Building2 } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Header({ toggleSidebar }) {
  const { activeProjectId, selectProject } = useProject();
  const [projects, setProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('project_members')
          .select('role, projects(id, name)')
          .eq('user_id', user.id);
        
        if (data) {
          const formatted = data.filter(i => i.projects).map(i => ({
            id: i.projects.id,
            name: i.projects.name,
            role: i.role
          }));
          setProjects(formatted);
        }
      }
    };
    fetchProjects();
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const handleSelectProject = (proj) => {
    selectProject(proj.id, proj.role);
    setIsDropdownOpen(false);
    window.location.reload(); // Reload agar data di halaman ter-refresh
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-50 relative">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
          <Menu size={20} />
        </button>
        
        {/* PROJECT SWITCHER DROPDOWN */}
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Building2 size={18} className="text-indigo-600" />
            <span className="text-sm font-bold text-slate-700 max-w-[200px] truncate">
              {activeProject ? activeProject.name : 'Pilih Proyek'}
            </span>
            <ChevronDown size={16} className="text-slate-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">Daftar Proyek Anda</div>
              <div className="max-h-60 overflow-y-auto">
                {projects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors flex flex-col ${activeProjectId === proj.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                  >
                    <span className="font-bold text-slate-800 line-clamp-1">{proj.name}</span>
                    <span className="text-xs text-slate-500 uppercase font-semibold mt-1">Role: {proj.role}</span>
                  </button>
                ))}
                {projects.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">Tidak ada proyek</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Cari task, material..." className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64" />
        </div>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-slate-800">Admin User</div>
            <div className="text-xs text-slate-500 font-medium">OWNER</div>
          </div>
          <UserCircle size={36} className="text-indigo-600" />
        </div>
      </div>
    </header>
  );
}