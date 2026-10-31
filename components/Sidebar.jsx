'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const menus = [
    { name: 'Dashboard S-Curve', path: '/', icon: '📊' },
    { name: 'Gantt Workspace', path: '/gantt', icon: '📅' },
    { name: 'Tasks (WBS)', path: '/tasks', icon: '📝' },
    { name: 'Progress Harian', path: '/progress', icon: '📈' },
    { name: 'Laporan Harian', path: '/reports/daily', icon: '📋' },
    { name: 'Laporan Mingguan', path: '/reports/weekly', icon: '📄' },
    { name: 'AHSP', path: '/ahsp', icon: '📦' },
    { name: 'Resources', path: '/resources', icon: '🔗' },
    { name: 'HSD (Harga Satuan)', path: '/hsd', icon: '💰' },
    { name: 'Assignments', path: '/assignments', icon: '📌' },
    { name: 'Kalender Kerja', path: '/settings/calendar', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col gap-2 shrink-0 print:hidden">
      <div className="text-xl font-bold mb-6 p-2 border-b border-slate-700">Project Schedule</div>
      {menus.map((menu) => (
        <Link key={menu.path} href={menu.path} className={`p-3 rounded-lg flex items-center gap-3 transition-colors ${pathname === menu.path ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
          <span>{menu.icon}</span><span>{menu.name}</span>
        </Link>
      ))}
    </div>
  );
}
