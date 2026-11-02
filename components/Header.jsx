'use client';
import { Menu, Search, Bell, ChevronDown, UserCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Header({ toggleSidebar, currentUser }) {
  const [showProfile, setShowProfile] = useState(false);
  const [projectName, setProjectName] = useState('Memuat Proyek...');

  // --- FETCH & REALTIME NAMA PROYEK ---
  useEffect(() => {
    const fetchProject = async () => {
      const { data } = await supabase.from('projects').select('name').limit(1).single();
      if (data) setProjectName(data.name);
    };
    
    fetchProject();

    // Dengarkan perubahan secara realtime
    const channel = supabase.channel('realtime-projects')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, (payload) => {
        setProjectName(payload.new.name); // Update state secara langsung
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const roleColors = {
    owner: 'bg-amber-100 text-amber-800 border-amber-300',
    admin: 'bg-blue-100 text-blue-800 border-blue-300',
    pelaksana: 'bg-green-100 text-green-800 border-green-300'
  };

  return (
    <header className="h-[64px] bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-30 relative shadow-sm">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        
        {/* DROPDOWN PROYEK DINAMIS */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
          <span className="text-sm font-semibold text-slate-700 truncate max-w-[250px]" title={projectName}>
            {projectName}
          </span>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">AKTIF</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Bar (opsional) */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari task, material..." className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 border border-slate-300 px-1 rounded">Ctrl K</span>
        </div>

        <button className="p-2 text-slate-500 hover:text-slate-800 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>

        <div className="h-6 w-px bg-slate-300 mx-2"></div>

        {/* Profil User */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(!showProfile)}>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800 leading-none">{currentUser?.name || 'Admin User'}</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase mt-1">{currentUser?.role || 'Owner'}</p>
          </div>
          <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold border border-indigo-200">
            <UserCircle className="w-6 h-6" />
          </div>
        </div>
      </div>
    </header>
  );
}