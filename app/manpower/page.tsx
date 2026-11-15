'use client';
import { useState } from 'react';
import { Users, CalendarDays, Banknote, Loader2 } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { EmployeeManager } from '@/components/payroll/EmployeeManager';
import { AttendanceManager } from '@/components/payroll/AttendanceManager';
import { PayrollManager } from '@/components/payroll/PayrollManager';

export default function ManpowerPage() {
  const { activeProjectId } = useProject();
  const [activeTab, setActiveTab] = useState('employees');

  const tabClass = (isActive: boolean) => 
    `flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap rounded-t-xl ${
      isActive 
        ? 'border-indigo-600 text-indigo-700 bg-indigo-50/80 shadow-[inset_0_-2px_0_0_#4f46e5]' 
        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
    }`;

  // PERBAIKAN: Menambahkan Spinner Loader
  if (!activeProjectId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500 font-bold animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span>Memuat data proyek...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="w-full max-w-[1920px] mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-indigo-100 text-indigo-700 rounded-xl">
            <Users size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manajemen Tenaga Kerja & Payroll</h1>
            <p className="text-slate-500 mt-1">Kelola data staf kantor, staf proyek, absensi, dan penggajian (Non-Mandor/Tukang).</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-px">
          <button onClick={() => setActiveTab('employees')} className={tabClass(activeTab === 'employees')}>
            <Users className="w-4 h-4" /> Master Karyawan
          </button>
          <button onClick={() => setActiveTab('attendance')} className={tabClass(activeTab === 'attendance')}>
            <CalendarDays className="w-4 h-4" /> Absensi Harian
          </button>
          <button onClick={() => setActiveTab('payroll')} className={tabClass(activeTab === 'payroll')}>
            <Banknote className="w-4 h-4" /> Proses Gaji (Payroll)
          </button>
        </div>

        {activeTab === 'employees' && <EmployeeManager projectId={activeProjectId} />}
        {activeTab === 'attendance' && <AttendanceManager projectId={activeProjectId} />}
        {activeTab === 'payroll' && <PayrollManager projectId={activeProjectId} />}

      </div>
    </div>
  );
}