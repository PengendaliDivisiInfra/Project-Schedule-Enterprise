'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, GanttChartSquare, ListTree, TrendingUp, 
  FileText, CalendarDays, Box, Package, Users, Database, 
  Settings, ShieldCheck, ShieldAlert, ChevronLeft, ChevronRight, HardHat, Wallet
} from 'lucide-react';

export default function Sidebar({ isCollapsed, toggleSidebar, currentUser }) {
  const pathname = usePathname();
  const role = currentUser?.role || 'pelaksana';

  // Definisi Menu & RBAC Gate
  const menuItems = [
    { group: 'UTAMA', items: [
      { name: 'Dashboard S-Curve', path: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'pelaksana'] },
      { name: 'Gantt Workspace', path: '/gantt', icon: GanttChartSquare, roles: ['owner', 'admin'] },
    ]},
    { group: 'PERENCANAAN', items: [
      { name: 'Tasks (WBS)', path: '/tasks', icon: ListTree, roles: ['owner', 'admin'] },
      { name: 'Progress Harian', path: '/progress', icon: TrendingUp, roles: ['owner', 'admin', 'pelaksana'] },
      { name: 'Risk Register', path: '/risks', icon: ShieldAlert, roles: ['owner', 'admin'] },
      { name: 'QHSE (Mutu & K3)', path: '/qhse', icon: HardHat, roles: ['owner', 'admin', 'pelaksana'] },
    ]},
    { group: 'PELAPORAN', items: [
      { name: 'Laporan Harian', path: '/reports/daily', icon: FileText, roles: ['owner', 'admin'] },
      { name: 'Laporan Mingguan', path: '/reports/weekly', icon: CalendarDays, roles: ['owner', 'admin'] },
      { name: 'Master Project Report', path: '/reports/master', icon: FileText, roles: ['owner', 'admin'] },
    ]},
    { group: 'MANAJEMEN BIAYA', items: [
      { name: 'AHSP PUPR', path: '/ahsp', icon: Box, roles: ['owner', 'admin'] },
      { name: 'Resources', path: '/resources', icon: Users, roles: ['owner', 'admin'] },
      { name: 'Material Requirement', path: '/materials', icon: Package, roles: ['owner', 'admin'] },
      { name: 'HSD (Harga Satuan)', path: '/hsd', icon: Package, roles: ['owner', 'admin'] },
      { name: 'Assignments', path: '/assignments', icon: Database, roles: ['owner', 'admin'] },
      { name: 'Cash Flow', path: '/finances', icon: Wallet, roles: ['owner', 'admin'] },
      { name: 'Approval Workflow', path: '/approvals', icon: ShieldCheck, roles: ['owner', 'admin'] },
      { name: 'S-Curve Chart', path: '/s-curve', icon: TrendingUp, roles: ['owner', 'admin'] },
    ]},
    { group: 'SISTEM', items: [
      { name: 'Database Proyek', path: '/projects', icon: Database, roles: ['owner'] },
      { name: 'Kalender Kerja', path: '/settings/calendar', icon: Settings, roles: ['owner', 'admin'] },
      { name: 'Audit Logs', path: '/logs', icon: ShieldCheck, roles: ['owner'] },
    ]}
  ];

  return (
    <aside className={`bg-[#0F172A] text-slate-300 flex flex-col h-screen shrink-0 transition-all duration-300 z-40 relative ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}`}>
      
      {/* 1. BRAND LOGO (Fixed di Atas) */}
      <div className="h-[64px] flex items-center px-4 border-b border-slate-800 shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shrink-0 overflow-hidden p-0.5">
          <img src="/logo-infrastruktur.jpeg" alt="InfraControl Logo" className="w-full h-full object-cover rounded-lg" />
        </div>
        {!isCollapsed && (
          <div className="ml-3 flex items-center animate-fade-in">
            <span className="font-bold text-white text-lg tracking-wide">InfraControl</span>
            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded ml-2 font-bold">PRO</span>
          </div>
        )}
      </div>

      {/* 2. MENU ITEMS (Scrollable & Scrollbar Disembunyikan) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-6 no-scrollbar">
        {menuItems.map((group, idx) => {
          const visibleItems = group.items.filter(item => item.roles.includes(role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx}>
              {!isCollapsed && <p className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{group.group}</p>}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <Link 
                      key={item.path} 
                      href={item.path}
                      title={isCollapsed ? item.name : ''}
                      className={`flex items-center px-3 py-2.5 rounded-md transition-all group relative
                        ${isActive ? 'bg-blue-600/10 text-blue-400 font-semibold' : 'hover:bg-slate-800 hover:text-white'}
                      `}
                    >
                      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-md"></div>}
                      <Icon size={18} className={`shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-white'}`} />
                      {!isCollapsed && <span className="ml-3 text-sm truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. FOOTER (Fixed di Bawah) */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <button onClick={toggleSidebar} className="w-full flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white">
          {isCollapsed ? <ChevronRight size={18} /> : <div className="flex items-center gap-2"><ChevronLeft size={18} /><span className="text-xs font-bold">Collapse Sidebar</span></div>}
        </button>
      </div>

    </aside>
  );
}
