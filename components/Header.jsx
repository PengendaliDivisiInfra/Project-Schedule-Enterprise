'use client';
import Link from 'next/link';
import { Menu, Search, Bell, ChevronDown, Building2, HelpCircle, WifiOff, RefreshCw } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { processSyncQueue, getPendingOfflineCount } from '../lib/services/sync-service';

export default function Header({ toggleSidebar, currentUser, openSearch }) {
  const { activeProjectId, selectProject } = useProject();
  const { globalRole, projectRole, role } = useRole(activeProjectId || undefined);
  const [projects, setProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // State PWA
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const updatePendingCount = async () => {
      try {
        const counts = await getPendingOfflineCount();
        setPendingSyncs(counts.total);
      } catch {
        setPendingSyncs(0);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      processSyncQueue()
        .finally(() => {
          setIsSyncing(false);
          updatePendingCount();
        });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

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

  const displayName =
    currentUser?.full_name ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'Pengguna');

  const displayRole =
    (globalRole && globalRole.toLowerCase() !== 'user' ? globalRole : null) ||
    projectRole ||
    activeProject?.role ||
    role ||
    'Member';

  const userInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <header className="h-[72px] bg-white/85 backdrop-blur-xl border-b border-slate-200/75 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex items-center justify-between px-6 sticky top-0 z-40 print:hidden transition-all">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all duration-200 active:scale-95"
          title="Toggle Sidebar"
        >
          <Menu size={22} />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="group flex items-center gap-3 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-full transition-all shadow-sm hover:shadow-md"
          >
            <div className="relative p-1.5 bg-indigo-50 text-indigo-600 rounded-full group-hover:bg-indigo-100 transition-colors">
              <Building2 size={14} />
              {activeProject && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
              )}
            </div>
            <span className="text-sm font-bold text-slate-800 max-w-[210px] truncate">
              {activeProject ? activeProject.name : 'Pilih Proyek'}
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-3 w-80 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Daftar Proyek Anda</div>
              <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                {projects.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 italic text-center">Belum ada proyek yang ditugaskan.</div>
                ) : (
                  projects.map(proj => (
                    <button
                      key={proj.id}
                      onClick={() => handleSelectProject(proj)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex flex-col mb-1 border ${activeProjectId === proj.id ? 'bg-indigo-50/80 border-indigo-100' : 'border-transparent hover:bg-slate-50'}`}
                    >
                      <span className={`font-bold text-sm truncate ${activeProjectId === proj.id ? 'text-indigo-700' : 'text-slate-700'}`}>{proj.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Role: {proj.role}</span>
                    </button>
                  ))
                )}
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
          <button
            type="button"
            onClick={() => {
              setIsSyncing(true);
              processSyncQueue().finally(() => setIsSyncing(false));
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-200 hover:bg-blue-100"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{isSyncing ? 'Sinkronisasi...' : `${pendingSyncs} data tertunda`}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={openSearch}
          className="relative hidden lg:flex items-center gap-2.5 pl-3.5 pr-3 py-2 bg-slate-100/60 hover:bg-slate-100 border border-transparent hover:border-indigo-200 rounded-full text-sm transition-all w-72 text-slate-400 text-left"
        >
          <Search size={16} className="shrink-0 text-slate-400" />
          <span className="flex-1 truncate">Cari menu, task, WBS...</span>
          <kbd className="text-[10px] font-mono font-bold bg-white text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">Ctrl K</kbd>
        </button>

        <Link
          href="/sop"
          title="SOP & Panduan"
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all hidden sm:block"
        >
          <HelpCircle size={20} />
        </Link>

        <Link
          href="/approvals"
          title="Dasbor Persetujuan"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full relative transition-all"
        >
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
        </Link>

        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        <Link href="/settings/security" className="flex items-center gap-3 cursor-pointer group" title="Profil & Keamanan 2FA">
          <div className="text-right hidden md:block">
            <div className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors max-w-[160px] truncate">
              {displayName}
            </div>
            <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5 inline-block uppercase tracking-wider border border-slate-200 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-colors">
              {displayRole}
            </div>
          </div>
          <div className="p-[2px] bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 rounded-full shadow-sm group-hover:shadow-md group-hover:scale-[1.03] transition-all">
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-extrabold tracking-wider">
              {userInitials}
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
