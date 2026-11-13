'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Building2,
  LayoutDashboard, Calendar, ListTodo, FileText, Activity, AlertTriangle, 
  Database, FileSpreadsheet, Users, Package, Fuel, Coins, FileCheck, 
  TrendingUp, Settings, ShieldCheck 
} from 'lucide-react';

export default function Sidebar({ activeProjectId, isCollapsed }) {
  const pathname = usePathname();
  const isActive = (path) => pathname === path;
  const isPathIncludes = (path) => pathname.includes(path);
  const projectId = activeProjectId || '886c80c3-4151-4c37-82e7-58a2460af645';

  const baseMenu = `flex items-center rounded-xl transition-all duration-300 group ${
    isCollapsed ? 'justify-center px-0 py-3 w-12 h-12 mx-auto' : 'gap-3 px-3 py-2.5 w-full text-sm'
  }`;
  
  const inactiveMenu = "text-slate-400 hover:bg-slate-800/50 hover:text-white";
  const activeMenu = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-500/50";

  return (
    <aside 
      className={`bg-[#090c15] text-slate-300 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800/60 z-50 print:hidden transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      
      {/* HEADER LOGO */}
      <div className={`h-24 flex items-center border-b border-slate-800/60 shrink-0 bg-[#090c15] transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'px-6'}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-md opacity-20 rounded-full"></div>
            <img src="/logo-divisi-infrastruktur.png" alt="Logo" className="relative w-10 h-10 object-contain drop-shadow-xl" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col justify-center animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-[10px] font-bold text-blue-400 tracking-[0.25em] uppercase leading-tight mb-0.5">Divisi</span>
              <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-wide leading-tight">Infrastruktur</span>
            </div>
          )}
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className={`flex-1 py-6 space-y-8 overflow-y-auto custom-scrollbar overflow-x-hidden transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        
        {/* SECTION 1: UTAMA (Menu Manajemen Proyek DIHAPUS dari sini) */}
        <div>
          {!isCollapsed && <p className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Utama</p>}
          <div className="space-y-1.5">
            <Link href="/dashboard" title="Dasbor S-Curve" className={`${baseMenu} ${isActive('/dashboard') ? activeMenu : inactiveMenu}`}>
              <LayoutDashboard size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Dasbor S-Curve</span>}
            </Link>
            <Link href="/gantt" title="Ruang Kerja Gantt" className={`${baseMenu} ${isActive('/gantt') ? activeMenu : inactiveMenu}`}>
              <Calendar size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Ruang Kerja Gantt</span>}
            </Link>
            <Link href="/tasks" title="Tugas (WBS)" className={`${baseMenu} ${isActive('/tasks') ? activeMenu : inactiveMenu}`}>
              <ListTodo size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Tugas (WBS)</span>}
            </Link>
            <Link href="/progress" title="Progres Harian" className={`${baseMenu} ${isActive('/progress') ? activeMenu : inactiveMenu}`}>
              <Activity size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Progres Harian</span>}
            </Link>
            <Link href="/risks" title="Daftar Risiko" className={`${baseMenu} ${isActive('/risks') ? activeMenu : inactiveMenu}`}>
              <AlertTriangle size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Daftar Risiko</span>}
            </Link>
          </div>
        </div>

        {/* SECTION 2: PELAPORAN */}
        <div>
          {!isCollapsed && <p className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Pelaporan</p>}
          <div className="space-y-1.5">
            <Link href={`/projects/${projectId}/reports/master`} title="Laporan Induk" className={`${baseMenu} ${isPathIncludes('/reports/master') ? activeMenu : inactiveMenu}`}>
              <FileText size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Laporan Induk</span>}
            </Link>
            <Link href={`/projects/${projectId}/reports/pnl`} title="Laba Rugi (P&L)" className={`${baseMenu} ${isPathIncludes('/reports/pnl') ? activeMenu : inactiveMenu}`}>
              <FileSpreadsheet size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Laba Rugi (P&L)</span>}
            </Link>
          </div>
        </div>

        {/* SECTION 3: MANAJEMEN BIAYA */}
        <div>
          {!isCollapsed && <p className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Manajemen Biaya</p>}
          <div className="space-y-1.5">
            <Link href="/ahsp" title="AHSP PUPR" className={`${baseMenu} ${isActive('/ahsp') ? activeMenu : inactiveMenu}`}>
              <Database size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>AHSP PUPR</span>}
            </Link>
            <Link href="/resources" title="Sumber Daya" className={`${baseMenu} ${isActive('/resources') ? activeMenu : inactiveMenu}`}>
              <Users size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Sumber Daya</span>}
            </Link>
            <Link href="/materials" title="Kebutuhan Material" className={`${baseMenu} ${isActive('/materials') ? activeMenu : inactiveMenu}`}>
              <Package size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Kebutuhan Material</span>}
            </Link>
            <Link href={`/projects/${projectId}/equipment/fuel`} title="Alat & BBM" className={`${baseMenu} ${isPathIncludes('/equipment') ? activeMenu : inactiveMenu}`}>
              <Fuel size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Alat & BBM</span>}
            </Link>
            <Link href="/hsd" title="HSD (Harga Satuan)" className={`${baseMenu} ${isActive('/hsd') ? activeMenu : inactiveMenu}`}>
              <FileSpreadsheet size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>HSD (Harga Satuan)</span>}
            </Link>
            <Link href="/assignments" title="Penugasan" className={`${baseMenu} ${isActive('/assignments') ? activeMenu : inactiveMenu}`}>
              <Users size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Penugasan</span>}
            </Link>
            <Link href="/finances" title="Arus Kas" className={`${baseMenu} ${isActive('/finances') ? activeMenu : inactiveMenu}`}>
              <Coins size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Arus Kas</span>}
            </Link>
            <Link href={`/projects/${projectId}/termin`} title="Termin / Kas Masuk" className={`${baseMenu} ${isPathIncludes('/termin') ? activeMenu : inactiveMenu}`}>
              <FileCheck size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Termin / Kas Masuk</span>}
            </Link>
            <Link href={`/projects/${projectId}/subcontractors`} title="Subkontraktor" className={`${baseMenu} ${isPathIncludes('/subcontractors') ? activeMenu : inactiveMenu}`}>
              <Users size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Subkontraktor</span>}
            </Link>
            <Link href="/approvals" title="Alur Persetujuan" className={`${baseMenu} ${isActive('/approvals') ? activeMenu : inactiveMenu}`}>
              <ShieldCheck size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Alur Persetujuan</span>}
            </Link>
            <Link href="/s-curve" title="Grafik S-Curve" className={`${baseMenu} ${isActive('/s-curve') ? activeMenu : inactiveMenu}`}>
              <TrendingUp size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Grafik S-Curve</span>}
            </Link>
          </div>
        </div>

        {/* SECTION 4: SISTEM */}
        <div>
          {!isCollapsed && <p className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Sistem</p>}
          <div className="space-y-1.5">
            
            {/* TAMBAHAN BARU: MANAJEMEN PROYEK DIPINDAHKAN KE SINI */}
            <Link href="/projects" title="Manajemen Proyek" className={`${baseMenu} ${isActive('/projects') || isPathIncludes('/projects/new') ? activeMenu : inactiveMenu}`}>
              <Building2 size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Manajemen Proyek</span>}
            </Link>

            <Link href="/settings/project" title="Pengaturan" className={`${baseMenu} ${isActive('/settings/project') ? activeMenu : inactiveMenu}`}>
              <Settings size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Pengaturan</span>}
            </Link>
            <Link href="/settings/team" title="Manajemen Tim" className={`${baseMenu} ${isActive('/settings/team') ? activeMenu : inactiveMenu}`}>
              <Users size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Manajemen Tim</span>}
            </Link>
            <Link href="/sop" title="SOP & Panduan" className={`${baseMenu} ${isActive('/sop') ? activeMenu : inactiveMenu}`}>
              <FileText size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>SOP & Panduan</span>}
            </Link>
            <Link href="/logs" title="Log Audit" className={`${baseMenu} ${isActive('/logs') ? activeMenu : inactiveMenu}`}>
              <ShieldCheck size={20} className="shrink-0 transition-transform group-hover:scale-110" /> 
              {!isCollapsed && <span>Log Audit</span>}
            </Link>
          </div>
        </div>

      </nav>
    </aside>
  );
}