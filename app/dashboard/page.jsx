'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import { Activity, DollarSign, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { activeProjectId } = useProject();
  const [loading, setLoading] = useState(true);
  
  // State untuk Kartu Ringkasan
  const [bac, setBac] = useState(0);
  const [actualCost, setActualCost] = useState(0);
  const [progress, setProgress] = useState(0);
  const [spi, setSpi] = useState(1);
  const [cpi, setCpi] = useState(1);
  
  // State untuk Grafik
  const [sCurveData, setSCurveData] = useState([]);

  useEffect(() => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Ambil Data WBS untuk menghitung Total Anggaran (BAC) & Progres
        const { data: tasks } = await supabase
          .from('wbs_tasks')
          .select('cost, progress_percent')
          .eq('project_id', activeProjectId);

        // 2. Ambil Data Kas Keluar Approved (Actual Cost)
        const { data: flows } = await supabase
          .from('cash_flows')
          .select('amount')
          .eq('project_id', activeProjectId)
          .eq('type', 'KELUAR')
          .eq('approval_status', 'Approved');

        // 3. Ambil Data S-Curve
        const { data: chartData } = await supabase
          .from('v_s_curve_data')
          .select('*')
          .eq('project_id', activeProjectId)
          .order('month', { ascending: true });

        if (chartData) setSCurveData(chartData);

        // Kalkulasi Metrik
        if (tasks && tasks.length > 0) {
          const totalBac = tasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);
          const totalProgress = tasks.reduce((sum, t) => sum + (Number(t.progress_percent) || 0), 0) / tasks.length;
          
          setBac(totalBac);
          setProgress(totalProgress);
          
          // Kalkulasi CPI & SPI Sederhana (Baseline)
          const totalActual = flows ? flows.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) : 0;
          setActualCost(totalActual);
          
          const earnedValue = totalBac * (totalProgress / 100);
          setCpi(totalActual > 0 ? earnedValue / totalActual : 1.0);
          setSpi(totalProgress > 0 ? totalProgress / 50 : 1.0); // Asumsi target 50% (Bisa disesuaikan)
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [activeProjectId]);

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;
  }

  if (!activeProjectId) {
    return <div className="p-10 text-center text-slate-500 font-bold">Silakan pilih proyek di Header terlebih dahulu.</div>;
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Executive Dashboard (Real-Time)</h1>
          <p className="text-sm text-slate-500 mt-1">Ringkasan status proyek berdasarkan data aktual lapangan.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Anggaran (BAC)</p>
              <div className="p-2 bg-blue-50 rounded-lg"><DollarSign className="text-blue-600" size={20} /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatRp(bac)}</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Akumulasi Progres</p>
              <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="text-emerald-600" size={20} /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{progress.toFixed(2)}%</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Schedule Performance (SPI)</p>
              <div className="p-2 bg-amber-50 rounded-lg"><Activity className="text-amber-600" size={20} /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{spi.toFixed(2)}</p>
            <p className="text-xs font-semibold mt-1 text-amber-600">{spi >= 1 ? 'Sesuai Jadwal / Cepat' : 'Terlambat'}</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cost Performance (CPI)</p>
              <div className="p-2 bg-emerald-50 rounded-lg"><AlertTriangle className="text-emerald-600" size={20} /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{cpi.toFixed(2)}</p>
            <p className="text-xs font-semibold mt-1 text-emerald-600">{cpi >= 1 ? 'Hemat / Sesuai Budget' : 'Overbudget'}</p>
          </div>
        </div>

        {/* S-Curve Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800">Grafik Kurva S (S-Curve)</h3>
            <p className="text-sm text-slate-500">Visualisasi komparasi Rencana (Plan) vs Aktual (Actual) berdasarkan data proyek aktif.</p>
          </div>
          
          <div className="flex-1 w-full min-h-[350px]">
            {sCurveData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sCurveData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)} Jt`} tick={{fontSize: 12, fill: '#64748b'}} width={90} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => formatRp(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="planned_cost_cumulative" name="Rencana (Plan)" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPlan)" />
                  <Line type="monotone" dataKey="actual_cost_cumulative" name="Realisasi (Aktual)" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <Activity className="w-12 h-12 mb-2 opacity-20" />
                <p className="font-semibold text-slate-500">Belum ada data Kurva S untuk proyek ini.</p>
                <p className="text-sm">Pastikan WBS sudah memiliki tanggal mulai dan transaksi kas telah di-approve.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}