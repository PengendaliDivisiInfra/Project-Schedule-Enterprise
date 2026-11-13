'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Filter, Download, RefreshCw, BarChart3, Database, Loader2 } from 'lucide-react';

export default function ProgressHarianPage() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simulasi Fetch Data (Sesuaikan dengan query Supabase Anda)
  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      // Contoh query: 
      // const { data } = await supabase.from('v_wbs_progress').select('*')
      
      // Data Dummy untuk keperluan UI
      const dummyData = [
        { wbs: '1.2', nama: 'Mobilisasi Wiremesh', volume: 42293.96, satuan: 'unit', realisasi: 0.00 },
        { wbs: '1.3', nama: 'Mobilisasi Besi 10', volume: 16836.7, satuan: 'unit', realisasi: 0.00 },
        { wbs: '1.4', nama: 'Mobilisasi Besi 16', volume: 48627.65, satuan: 'unit', realisasi: 0.00 },
        { wbs: '1.5', nama: 'Mobilisasi Besi 19', volume: 88763.98, satuan: 'unit', realisasi: 0.00 },
        { wbs: '2', nama: 'Pekerjaan Borpile', volume: 0, satuan: 'unit', realisasi: 0.00 },
        { wbs: '2.1', nama: 'Pengeboran', volume: 2610, satuan: 'M1', realisasi: 0.00 },
        { wbs: '2.2', nama: 'Pemasangan Pipa Casing', volume: 2610, satuan: 'M1', realisasi: 0.00 },
        { wbs: '2.3', nama: 'Pemasangan Besi Tulangan Spiral', volume: 85500, satuan: 'M1', realisasi: 0.00 },
        { wbs: '2.4', nama: 'Pengecoran Mutu Fc40', volume: 1311, satuan: 'M3', realisasi: 0.00 },
        { wbs: '3', nama: 'Pekerjaan DPT', volume: 0, satuan: 'unit', realisasi: 0.00 },
      ];
      
      setData(dummyData);
      setLoading(false);
    };

    fetchProgress();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000); // Simulasi loading
  };

  const formatNum = (num) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

  const filteredData = data.filter(item => 
    item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.wbs.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-indigo-600" size={28} /> Rekapitulasi Progress Harian
          </h1>
          <p className="text-sm text-slate-500 mt-1">Pantau realisasi volume pekerjaan lapangan secara <em>real-time</em> berdasarkan data WBS.</p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm font-semibold">
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-2 text-sm font-bold">
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* 2. MAIN CARD & TOOLBAR */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Toolbar */}
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

        {/* 3. ENTERPRISE DATA GRID */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-24">WBS</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Nama Pekerjaan</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right w-40">Volume Kontrak</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center w-24">Satuan</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right w-48 bg-indigo-50/30">Total Realisasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Memuat data progress...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search size={24} className="text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 mb-1">Pekerjaan Tidak Ditemukan</h3>
                    <p className="text-slate-500 text-sm">Tidak ada data yang cocok dengan pencarian "{searchTerm}".</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    {/* WBS - Gaya Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-mono text-xs font-bold border border-slate-200 group-hover:bg-white group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                        {item.wbs}
                      </span>
                    </td>
                    
                    {/* Nama Pekerjaan */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                        {item.nama}
                      </span>
                    </td>
                    
                    {/* Volume Kontrak */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-sm tabular-nums text-slate-600">
                        {formatNum(item.volume)}
                      </span>
                    </td>
                    
                    {/* Satuan */}
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {item.satuan}
                      </span>
                    </td>
                    
                    {/* Realisasi */}
                    <td className="px-6 py-4 text-right bg-indigo-50/10 group-hover:bg-indigo-50/30 transition-colors">
                      <span className={`font-mono text-sm tabular-nums font-bold ${item.realisasi > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {formatNum(item.realisasi)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Pagination (Dummy) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
          <span>Menampilkan 1-10 dari {filteredData.length} item</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50" disabled>&laquo; Prev</button>
            <button className="px-3 py-1 bg-indigo-600 text-white rounded-lg shadow-sm">1</button>
            <button className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-white">2</button>
            <button className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-white">Next &raquo;</button>
          </div>
        </div>

      </div>
    </div>
  );
}