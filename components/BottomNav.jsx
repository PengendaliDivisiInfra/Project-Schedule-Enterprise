'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTodo, Package, Coins, UserCircle } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { activeProjectId } = useProject();
  const projectId = activeProjectId || 'default';

  // Menu yang sering diakses Field Worker
  const menuItems = [
    { name: 'Dasbor', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'WBS', icon: ListTodo, path: '/tasks' },
    { name: 'Material', icon: Package, path: '/materials' },
    { name: 'Kas', icon: Coins, path: '/finances' },
    { name: 'Profil', icon: UserCircle, path: '/settings/project' }, // Ganti dengan path profil Anda
  ];

  return (
    // Hanya tampil di layar mobile (md:hidden), dengan efek glassmorphism
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden print:hidden">
      {/* Padding bawah (pb-safe) berguna untuk iPhone yang punya home bar */}
      <div className="bg-white/90 backdrop-blur-xl border-t border-slate-200 px-6 pb-safe pt-2 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.includes(item.path));
            
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex flex-col items-center justify-center w-16 h-14 gap-1 rounded-xl transition-all duration-300 ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`relative p-1.5 rounded-full transition-all ${isActive ? 'bg-indigo-50' : 'bg-transparent'}`}>
                  <item.icon size={22} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                  {/* Titik indikator aktif */}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                  )}
                </div>
                <span className={`text-[10px] font-bold ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}