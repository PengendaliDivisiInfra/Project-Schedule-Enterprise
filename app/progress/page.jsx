'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, RefreshCw, BarChart3, Database, Loader2, CalendarDays, Download } from 'lucide-react';

export default function ProgressHarianPage() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // 1. Ambil semua leaf task
      const { data: tasks, error: taskErr } = await supabase
        .from('wbs_tasks')
        .select('id, wbs_code, name, volume, satuan_hsd, summary')
        .eq('summary', 'No');
      
      if (taskErr) throw taskErr;

      // 2. Ambil semua riwayat progress
      const { data: progress, error: progErr } = await supabase
        .from('daily_progress')
        .select('*');
      
      if (progErr) throw progErr;

      // 3. Gabungkan data
      const merged = tasks.map(t => {
        const taskProgress = progress ? progress.filter(p => p.task_id === t.id) : [];
        
        const todayData = taskProgress.find(p => p.record_date === today);
        const yesterdayData = taskProgress.find(p => p.record_date === yesterday);
        
        const latestData = taskProgress.length > 0 
          ? taskProgress.sort((a, b) => new Date(b.record_date) - new Date(a.record_date))[0] 
          : null;

        const totalRealisasi = latestData ? latestData.completed_volume : 0;
        const realisasiHariIni = todayData ? todayData.completed_volume : 0;
        const realisasiKemarin = yesterdayData ? yesterdayData.completed_volume : 0;

        return {
          ...t,
          realisasi_kemarin: realisasiKemarin,
          realisasi_hari_ini: realisasiHariIni,
          total_realisasi: totalRealisasi,
          progress_pct: t.volume > 0 ? (totalRealisasi / t.volume) * 100 : 0
        };
      });

      // 4. Filter yang > 0 DAN URUTKAN WBS SECARA NATURAL (1.2 sebelum 1.10)
      const filtered = merged.filter(m => m.total_realisasi > 0);
      filtered.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));
      
      setData(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchProgress();
  };

  // FUNGSI EXPORT KE EXCEL (CSV)
  const handleExport = () => {
    if (data.length === 0) return;

    const headers = ['WBS', 'Nama Pekerjaan', 'Volume Kontrak', 'Satuan', 'Realisasi Kemarin', 'Realisasi Hari Ini', 'Total s/d Hari Ini', 'Progres (%)'];
    
    const rows = data.map(item => [
      item.wbs_code,
      `"${item.name}"`, // Bungkus nama dengan kutip agar aman jika ada koma
      item.volume,
      item.satuan_hsd,
      item.realisasi_kemarin,
      item.realisasi_hari_ini,
      item.total_realisasi,
      item.progress_pct.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Daily_Progress_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatNum = (num) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.wbs_code.includes(searchTerm)
  );

  return (
    <div className="w-full min-h-screen bg-slate-50 p-6 md:p-8 animate-in fade-in duration-500">
      <div className="max-w-[1920px] mx-auto space-y-6">
        
        {/* HEADER PREMIUM */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" size={28} /> Rekapitulasi Progress Harian
            </h1>
            <p className="text-sm text-slate-500 mt-1">Pantau histori realisasi volume pekerjaan lapangan secara <em>real-time</em>.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} disabled={data.length === 0} className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-50">
              <Download size={16} /> Export Excel
            </button>
            <button onClick={handleRefresh} disabled={isRefreshing} className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-50">
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* TOOLBAR */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
            <div className="relative w-full sm:w-96 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Cari kode WBS atau nama pekerjaan..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-700"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Database size={16} /> Total <span className="font-bold text-slate-700">{filteredData.length}</span> Item Pekerjaan
            </div>
          </div>

          {/* DATA GRID */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-24">WBS</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 min-w-[250px]">Nama Pekerjaan</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Volume Kontrak</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Satuan</th>
                  
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right bg-orange-50/50">Realisasi Kemarin</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right bg-yellow-50/50">Realisasi Hari Ini</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right bg-emerald-50/50">Total s/d Hari Ini</th>
                  
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center w-32">Progres (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">Memuat data historis...</p>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CalendarDays size={24} className="text-slate-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700 mb-1">Belum Ada Progress Harian</h3>
                      <p className="text-slate-500 text-sm">Lakukan input di menu "Tugas (WBS)" terlebih dahulu.</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-mono text-xs font-bold border border-slate-200 group-hover:bg-white group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                          {item.wbs_code}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                          {item.name}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono text-sm tabular-nums text-slate-600">{formatNum(item.volume)}</span>
                      </td>
                      
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.satuan_hsd}</span>
                      </td>
                      
                      <td className="px-6 py-4 text-right bg-orange-50/10 group-hover:bg-orange-50/30 transition-colors">
                        <span className="font-mono text-sm tabular-nums font-semibold text-orange-600">
                          {formatNum(item.realisasi_kemarin)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right bg-yellow-50/10 group-hover:bg-yellow-50/30 transition-colors">
                        <span className="font-mono text-sm tabular-nums font-bold text-yellow-700">
                          {formatNum(item.realisasi_hari_ini)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right bg-emerald-50/10 group-hover:bg-emerald-50/30 transition-colors">
                        <span className="font-mono text-sm tabular-nums font-bold text-emerald-700">
                          {formatNum(item.total_realisasi)}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono text-xs font-bold text-indigo-600">{item.progress_pct.toFixed(1)}%</span>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${item.progress_pct}%` }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}