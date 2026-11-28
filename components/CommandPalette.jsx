'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useProject } from '../context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import {
  Search, LayoutDashboard, GanttChartSquare, ListTree, TrendingUp,
  FileText, CalendarDays, Box, Package, Users, Database, Settings, ShieldCheck, X,
  Coins, FileDiff, Award, GitBranch, KeyRound, HardHat, FileCheck, Fuel
} from 'lucide-react';

export default function CommandPalette({ isOpen, setIsOpen, activeProjectId: propProjectId }) {
  const router = useRouter();
  const { activeProjectId: ctxProjectId } = useProject();
  const activeProjectId = propProjectId || ctxProjectId || null;
  const { can } = useRole(activeProjectId || undefined);

  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loadedProjectId, setLoadedProjectId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const projectHref = (subpath) => (activeProjectId ? `/projects/${activeProjectId}${subpath}` : '/projects');

  const allMenus = [
    { name: 'Dasbor S-Curve', path: '/dashboard', icon: LayoutDashboard, type: 'Navigasi', allowed: true },
    { name: 'Ruang Kerja Gantt', path: '/gantt', icon: GanttChartSquare, type: 'Navigasi', allowed: true },
    { name: 'Tugas (WBS)', path: '/tasks', icon: ListTree, type: 'Navigasi', allowed: true },
    { name: 'Progres Harian (Offline & Foto)', path: '/progress', icon: TrendingUp, type: 'Navigasi', allowed: true },
    { name: 'Arus Kas & Kontrol Anggaran 3-Layer', path: '/finances', icon: Coins, type: 'Keuangan', allowed: true },
    { name: 'Termin, BAKP & Bank Garansi', path: projectHref('/termin'), icon: FileCheck, type: 'Keuangan', allowed: can('TERMIN_VIEW') },
    { name: 'Addendum / CCO & Versi RAB', path: '/change-orders', icon: FileDiff, type: 'Keuangan', allowed: true },
    { name: 'Alur Persetujuan (Approver)', path: '/approvals', icon: ShieldCheck, type: 'Persetujuan', allowed: true },
    { name: 'Matriks Approval Dinamis', path: '/settings/approval-matrix', icon: GitBranch, type: 'Pengaturan', allowed: true },
    { name: 'Material, PR, PO & 3-Way Match', path: '/materials', icon: Package, type: 'Pengadaan', allowed: true },
    { name: 'Kepatuhan Vendor, Blacklist & Scorecard', path: '/vendors/compliance', icon: Award, type: 'Pengadaan', allowed: true },
    { name: 'Alat Berat, Accrual & Custody QR Aset', path: projectHref('/equipment/custody'), icon: Fuel, type: 'Operasional', allowed: true },
    { name: 'QHSE & JSA / Work Permit Gate', path: '/qhse', icon: HardHat, type: 'HSE / K3', allowed: true },
    { name: 'Manpower, Absensi & Payroll', path: '/manpower', icon: Users, type: 'SDM', allowed: true },
    { name: 'Subkontraktor & SPK', path: projectHref('/subcontractors'), icon: Users, type: 'Pengadaan', allowed: true },
    { name: 'AHSP PUPR', path: '/ahsp', icon: Box, type: 'Engineering', allowed: true },
    { name: 'HSD (Harga Satuan)', path: '/hsd', icon: Package, type: 'Engineering', allowed: true },
    { name: 'Laporan Harian', path: '/reports/daily', icon: FileText, type: 'Laporan', allowed: true },
    { name: 'Laporan Mingguan', path: '/reports/weekly', icon: CalendarDays, type: 'Laporan', allowed: true },
    { name: 'Keamanan Akun & 2FA TOTP', path: '/settings/security', icon: KeyRound, type: 'Keamanan', allowed: true },
    { name: 'Log Audit (Immutable)', path: '/logs', icon: ShieldCheck, type: 'Keamanan', allowed: true },
    { name: 'Manajemen Proyek', path: '/projects', icon: Database, type: 'Sistem', allowed: true },
    { name: 'Kalender Kerja', path: '/settings/calendar', icon: Settings, type: 'Pengaturan', allowed: true },
  ];

  const visibleMenus = allMenus.filter((m) => m.allowed);

  // Reset cache task saat proyek aktif berubah agar WBS antar-proyek tidak pernah tercampur
  useEffect(() => {
    setTasks([]);
    setLoadedProjectId(null);
  }, [activeProjectId]);

  // Fetch WBS Tasks khusus proyek aktif saja
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      if (activeProjectId && loadedProjectId !== activeProjectId) {
        supabase
          .from('wbs_tasks')
          .select('id, wbs_code, name')
          .eq('project_id', activeProjectId)
          .order('wbs_code')
          .then(({ data }) => {
            if (data) {
              setTasks(
                data.map((t) => ({
                  name: `[${t.wbs_code}] ${t.name}`,
                  path: `/tasks?search=${encodeURIComponent(t.wbs_code)}`,
                  icon: ListTree,
                  type: 'Task WBS',
                }))
              );
              setLoadedProjectId(activeProjectId);
            }
          });
      }
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen, activeProjectId, loadedProjectId]);

  const allResults = [...visibleMenus, ...tasks];
  const filteredResults =
    query === ''
      ? visibleMenus.slice(0, 7)
      : allResults
          .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 10);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && filteredResults.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
    } else if (e.key === 'ArrowUp' && filteredResults.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
    } else if (e.key === 'Enter' && filteredResults.length > 0) {
      e.preventDefault();
      handleSelect(filteredResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (item) => {
    setIsOpen(false);
    router.push(item.path);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[14vh] bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white w-full max-w-xl rounded-xl shadow-2xl overflow-hidden animate-scale-in border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-slate-100 bg-slate-50/50">
          <Search size={20} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Cari menu enterprise, task, atau kode WBS proyek aktif..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-4 bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredResults.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              Tidak ada hasil yang ditemukan untuk "{query}"
            </div>
          ) : (
            filteredResults.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={`${item.path}-${index}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors ${
                    isSelected ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md shrink-0 ${
                        isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="font-medium text-sm truncate">{item.name}</span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded shrink-0 ml-2 ${
                      isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {item.type}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
          <div className="flex gap-4">
            <span><kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 mr-1">↑↓</kbd> Navigasi</span>
            <span><kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 mr-1">Enter</kbd> Pilih</span>
            <span><kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 mr-1">Esc</kbd> Tutup</span>
          </div>
          <span className="text-[11px] text-slate-400">Filter Proyek Aktif</span>
        </div>
      </div>
    </div>
  );
}
