'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, CalendarDays, ListTodo, TrendingUp, 
  FileText, FileSpreadsheet, Box, Link2, Coins, FolderKanban, Settings 
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const menus = [
    { name: 'Dashboard S-Curve', path: '/', icon: LayoutDashboard },
    { name: 'Gantt Workspace', path: '/gantt', icon: CalendarDays },
    { name: 'Tasks (WBS)', path: '/tasks', icon: ListTodo },
    { name: 'Progress Harian', path: '/progress', icon: TrendingUp },
    { name: 'Laporan Harian', path: '/reports/daily', icon: FileText },
    { name: 'Laporan Mingguan', path: '/reports/weekly', icon: FileSpreadsheet },
    { name: 'AHSP', path: '/ahsp', icon: Box },
    { name: 'Resources', path: '/resources', icon: Link2 },
    { name: 'HSD (Harga Satuan)', path: '/hsd', icon: Coins },
    { name: 'Assignments', path: '/assignments', icon: Box },
    { name: 'Database Proyek', path: '/projects', icon: FolderKanban },
    { name: 'Kalender Kerja', path: '/settings/calendar', icon: Settings },
  ];

  return (
    <div className="w-64 bg-[#0F172A] text-slate-300 flex flex-col shrink-0 print:hidden shadow-xl z-50">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white font-bold text-lg tracking-tight">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-xs">P</span>
          </div>
          ProManage <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 ml-auto">ENT</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        {menus.map((menu) => {
          const isActive = pathname === menu.path;
          const Icon = menu.icon;
          return (
            <Link 
              key={menu.path} 
              href={menu.path} 
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive ? 'bg-blue-600/10 text-blue-400 font-semibold' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              {/* Indikator Garis Kiri Aktif */}
              {isActive && <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-r-md"></div>}
              
              <Icon size={18} strokeWidth={1.5} className={`${isActive ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`} />
              <span className="text-sm">{menu.name}</span>
            </Link>
          );
        })}
      </div>

      {/* User Profile Anchor */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold border-2 border-slate-600">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">Admin User</span>
            <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-1.5 rounded w-fit">Head Controller</span>
          </div>
        </div>
      </div>
    </div>
  );
}
