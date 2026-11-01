'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, GanttChartSquare, ListTree, TrendingUp, 
  FileText, CalendarDays, Box, Package, Users, Database, 
  Settings, ShieldCheck, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function Sidebar({ isCollapsed, toggleSidebar, currentUser }) {
  const pathname = usePathname();
  const role = currentUser?.role || 'pelaksana';

  // Definisi Menu & RBAC Gate
  const menuItems = [
    { group: 'Utama', items: [
      { name: 'Dashboard S-Curve', path: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'pelaksana'] },
      { name: 'Gantt Workspace', path: '/gantt', icon: GanttChartSquare, roles: ['owner', 'admin'] },
    ]},
    { group: 'Perencanaan', items: [
      { name: 'Tasks (WBS)', path: '/tasks', icon: ListTree, roles: ['owner', 'admin'] },
      { name: 'Progress Harian', path: '/progress', icon: TrendingUp, roles: ['owner', 'admin', 'pelaksana'] },
    ]},
    { group: 'Pelaporan', items: [
      { name: 'Laporan Harian', path: '/reports/daily', icon: FileText, roles: ['owner', 'admin'] },
      { name: 'Laporan Mingguan', path: '/reports/weekly', icon: CalendarDays, roles: ['owner', 'admin'] },
    ]},
    { group: 'Manajemen Biaya', items: [
      { name: 'AHSP PUPR', path: '/ahsp', icon: Box, roles: ['owner', 'admin'] },
      { name: 'Resources', path: '/resources', icon: Users, roles: ['owner', 'admin'] },
      { name: 'HSD (Harga Satuan)', path: '/hsd', icon: Package, roles: ['owner', 'admin'] },
      { name: 'Assignments', path: '/assignments', icon: Database, roles: ['owner', 'admin'] },
    ]},
    { group: 'Sistem', items: [
      { name: 'Database Proyek', path: '/projects', icon: Database, roles: ['owner'] },
      { name: 'Kalender Kerja', path: '/settings/calendar', icon: Settings, roles: ['owner', 'admin'] },
      { name: 'Audit Logs', path: '/logs', icon: ShieldCheck, roles: ['owner'] },
    ]}
  ];

  return (
    <aside className={`bg-[#0F172A] text-slate-300 flex flex-col shrink-0 transition-all duration-300 z-40 relative ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}`}>
      {/* Brand Logo */}
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

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
        {menuItems.map((group, idx) => {
          // Filter items based on role
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

      {/* Toggle Button (Mini Mode) */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <button onClick={toggleSidebar} className="w-full flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white">
          {isCollapsed ? <ChevronRight size={18} /> : <div className="flex items-center gap-2"><ChevronLeft size={18} /><span className="text-xs font-bold">Collapse Sidebar</span></div>}
        </button>
      </div>
    </aside>
  );
}



