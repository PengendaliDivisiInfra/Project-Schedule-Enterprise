'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Droplets, Clock, FileText, FileSignature, Users, Truck } from 'lucide-react';

export default function EquipmentLayout({ children, params }) {
  const pathname = usePathname();
  const projectId = params.projectId;

  const tabs = [
    { name: 'Kontrak Alat', href: `/projects/${projectId}/equipment/contracts`, icon: FileSignature },
    { name: 'Daftar Vendor', href: `/projects/${projectId}/equipment/vendors`, icon: Users },
    { name: 'Unit Alat', href: `/projects/${projectId}/equipment/units`, icon: Truck }, // TAB BARU
    { name: 'Pengisian BBM', href: `/projects/${projectId}/equipment/fuel`, icon: Droplets },
    { name: 'Timesheet Alat', href: `/projects/${projectId}/equipment/timesheet`, icon: Clock },
    { name: 'Rekonsiliasi (BAR)', href: `/projects/${projectId}/equipment/bar`, icon: FileText },
  ];

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 pt-6 shadow-sm z-10 print:hidden">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Manajemen Alat & BBM</h1>
          <p className="text-sm text-slate-500 mb-4">Kontrol operasional alat sewa, konsumsi BBM, dan timesheet lapangan.</p>
          
          <div className="flex gap-6 border-b border-slate-200 overflow-x-auto custom-scrollbar">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex items-center gap-2 pb-3 px-1 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${
                    isActive ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon size={18} />
                  {tab.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex-1 max-w-7xl mx-auto w-full p-6">
        {children}
      </div>
    </div>
  );
}