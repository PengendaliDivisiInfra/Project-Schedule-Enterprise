'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { 
  Search, LayoutDashboard, GanttChartSquare, ListTree, TrendingUp, 
  FileText, CalendarDays, Box, Package, Users, Database, Settings, ShieldCheck, X 
} from 'lucide-react';

export default function CommandPalette({ isOpen, setIsOpen, currentUser }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const role = currentUser?.role || 'pelaksana';

  // Menu Navigasi (Di-filter berdasarkan RBAC)
  const allMenus = [
    { name: 'Dashboard S-Curve', path: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'pelaksana'], type: 'Navigasi' },
    { name: 'Gantt Workspace', path: '/gantt', icon: GanttChartSquare, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'Tasks (WBS)', path: '/tasks', icon: ListTree, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'Progress Harian', path: '/progress', icon: TrendingUp, roles: ['owner', 'admin', 'pelaksana'], type: 'Navigasi' },
    { name: 'Laporan Harian', path: '/reports/daily', icon: FileText, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'Laporan Mingguan', path: '/reports/weekly', icon: CalendarDays, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'AHSP PUPR', path: '/ahsp', icon: Box, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'Resources', path: '/resources', icon: Users, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'HSD', path: '/hsd', icon: Package, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'Assignments', path: '/assignments', icon: Database, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'Database Proyek', path: '/projects', icon: Database, roles: ['owner'], type: 'Navigasi' },
    { name: 'Kalender Kerja', path: '/settings/calendar', icon: Settings, roles: ['owner', 'admin'], type: 'Navigasi' },
    { name: 'Audit Logs', path: '/logs', icon: ShieldCheck, roles: ['owner'], type: 'Navigasi' },
  ];

  const visibleMenus = allMenus.filter(m => m.roles.includes(role));

  // Fetch Tasks untuk pencarian (hanya jika user membuka palette)
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      if (tasks.length === 0) {
        supabase.from('wbs_tasks').select('id, wbs_code, name').then(({ data }) => {
          if (data) setTasks(data.map(t => ({ name: `[${t.wbs_code}] ${t.name}`, path: `/tasks?search=${t.wbs_code}`, icon: ListTree, type: 'Task' })));
        });
      }
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Kombinasi Hasil Pencarian
  const allResults = [...visibleMenus, ...tasks];
  const filteredResults = query === '' 
    ? visibleMenus.slice(0, 5) // Tampilkan 5 menu default jika kosong
    : allResults.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  // Keyboard Navigation (Panah Atas/Bawah & Enter)
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
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
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
      <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl overflow-hidden animate-scale-in border border-slate-200" onClick={e => e.stopPropagation()}>
        
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-slate-100 bg-slate-50/50">
          <Search size={20} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Cari menu, task, atau WBS..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-4 bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredResults.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">Tidak ada hasil yang ditemukan untuk "{query}"</div>
          ) : (
            filteredResults.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={index}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon size={16} />
                    </div>
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${isSelected ? 'bg-blue-700 text-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                    {item.type}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Palette */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
          <div className="flex gap-4">
            <span><kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 mr-1">↑↓</kbd> Navigasi</span>
            <span><kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 mr-1">Enter</kbd> Pilih</span>
            <span><kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 mr-1">Esc</kbd> Tutup</span>
          </div>
        </div>
      </div>
    </div>
  );
}
