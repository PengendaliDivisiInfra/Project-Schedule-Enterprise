'use client';
import { useEffect, useState } from 'react';
import { Activity, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function DashboardPage() {
  const [totalProgress, setTotalProgress] = useState(0);

  const fetchDashboardData = async () => {
    // Simulasi kalkulasi progres sederhana (bisa dikembangkan jadi EVM penuh)
    const { data } = await supabase.from('daily_progress').select('completed_volume');
    if (data) {
      const sum = data.reduce((acc, curr) => acc + Number(curr.completed_volume), 0);
      // Anggap saja total progress adalah akumulasi volume (contoh kasar)
      setTotalProgress(sum);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // REAL-TIME LISTENER
    const channel = supabase.channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_progress' }, () => {
        console.log('🔄 Dashboard mendeteksi progres baru, memperbarui grafik...');
        fetchDashboardData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Executive Dashboard (Real-Time)</h1>
          <p className="text-sm text-slate-500">Ringkasan status proyek berdasarkan data aktual lapangan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Total Anggaran (BAC)</p>
            <p className="text-2xl font-bold text-slate-800">Rp 99.700.000</p>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Akumulasi Progres</p>
            <p className="text-2xl font-bold text-emerald-600">{totalProgress.toFixed(2)} <span className="text-xs font-normal text-slate-400">Vol</span></p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Schedule Performance (SPI)</p>
            <p className="text-2xl font-bold text-amber-600">0.85 <span className="text-xs font-normal text-slate-400">(Terlambat)</span></p>
          </div>
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Activity size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Cost Performance (CPI)</p>
            <p className="text-2xl font-bold text-emerald-600">1.12 <span className="text-xs font-normal text-slate-400">(Hemat)</span></p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><AlertTriangle size={20} /></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-96 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="z-10 text-center">
          <Activity size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-600 mb-1">Grafik Kurva S (S-Curve)</h3>
          <p className="text-sm text-slate-400">Visualisasi komparasi Rencana vs Aktual akan dirender di sini.</p>
        </div>
      </div>
    </div>
  );
}
