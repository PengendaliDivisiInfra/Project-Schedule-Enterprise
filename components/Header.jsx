'use client';
import { Menu, Search, Bell, ChevronDown, UserCircle, Building2, HelpCircle, WifiOff, RefreshCw } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db/offline-db';
import { processSyncQueue } from '../lib/services/sync-service';

export default function Header({ toggleSidebar }) {
  const { activeProjectId, selectProject } = useProject();
  const [projects, setProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // State PWA
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Setup status koneksi awal
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      processSyncQueue().finally(() => setIsSyncing(false));
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Polling antrean Dexie setiap 5 detik
    const interval = setInterval(async () => {
      const count = await db.syncQueue.count();
      setPendingSyncs(count);
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

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
    window.location.reload();
  };

  return (
    <header className="h-[72px] bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-6 sticky top-0 z-40 print:hidden transition-all">
      
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar} 
          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all duration-200 active:scale-95"
        >
          <Menu size={22} />
        </button>
        
        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="group flex items-center gap-3 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-full transition-all shadow-sm hover:shadow-md"
          >
            <div className="p-1.5 bg-indigo-100/50 text-indigo-600 rounded-full group-hover:bg-indigo-100 transition-colors">
              <Building2 size={14} />
            </div>
            <span className="text-sm font-bold text-slate-700 max-w-[180px] truncate">
              {activeProject ? activeProject.name : 'Pilih Proyek'}
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-3 w-80 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Daftar Proyek Anda</div>
              <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                {projects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex flex-col mb-1 border ${activeProjectId === proj.id ? 'bg-indigo-50/80 border-indigo-100' : 'border-transparent hover:bg-slate-50'}`}
                  >
                    <span className={`font-bold text-sm truncate ${activeProjectId === proj.id ? 'text-indigo-700' : 'text-slate-700'}`}>{proj.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Role: {proj.role}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        
        {/* --- INDIKATOR OFFLINE / SYNC --- */}
        {!isOnline ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold animate-pulse border border-amber-200">
            <WifiOff size={14} />
            <span className="hidden sm:inline">Offline {pendingSyncs > 0 && `(${pendingSyncs} antrean)`}</span>
          </div>
        ) : (pendingSyncs > 0 || isSyncing) ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-200">
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{isSyncing ? 'Sinkronisasi...' : `${pendingSyncs} data tertunda`}</span>
          </div>
        ) : null}

        <div className="relative hidden lg:block group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Cari task, material, vendor..." 
            className="pl-10 pr-4 py-2 bg-slate-100/60 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 rounded-full text-sm transition-all outline-none w-72 text-slate-700 placeholder-slate-400" 
          />
        </div>
        
        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all hidden sm:block">
          <HelpCircle size={20} />
        </button>

        <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full relative transition-all">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
        </button>
        
        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden md:block">
            <div className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">Admin User</div>
            <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5 inline-block uppercase tracking-wider border border-slate-200 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-colors">Owner</div>
          </div>
          <div className="p-0.5 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-full shadow-sm group-hover:shadow-md transition-all">
            <div className="bg-white p-0.5 rounded-full">
               <UserCircle size={32} className="text-slate-700" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}