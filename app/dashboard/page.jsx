'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import { Activity, DollarSign, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ComplianceWidget from '@/components/dashboard/ComplianceWidget';

export default function DashboardPage() {
  const { activeProjectId } = useProject();
  const [loading, setLoading] = useState(true);
  
  const [bac, setBac] = useState(0);
  const [contractValue, setContractValue] = useState(0);
  const [weightedProgress, setWeightedProgress] = useState(0);
  const [spi, setSpi] = useState(null);
  const [cpi, setCpi] = useState(null);
  const [sCurveData, setSCurveData] = useState([]);

  useEffect(() => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { data: project } = await supabase.from('projects').select('contract_value').eq('id', activeProjectId).single();
        if (project) setContractValue(Number(project.contract_value) || 0);

        const { data: tasks } = await supabase.from('wbs_tasks').select('cost, progress_percent, summary').eq('project_id', activeProjectId);

        const res = await fetch(`/api/analytics/scurve?project_id=${activeProjectId}`);
        const scurveRes = await res.json();
        
        if (scurveRes.ok && scurveRes.data) {
          setSCurveData(scurveRes.data);
        }

        if (tasks && tasks.length > 0) {
          const leafTasks = tasks.filter(t => t.summary !== 'Yes');
          const totalBac = leafTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);
          const totalWeightedCost = leafTasks.reduce((sum, t) => sum + (Number(t.cost) || 0) * ((Number(t.progress_percent) || 0) / 100), 0);
          const actualWeightedProgress = totalBac > 0 ? (totalWeightedCost / totalBac) * 100 : 0;
          
          setBac(totalBac);
          setWeightedProgress(actualWeightedProgress);

          if (scurveRes.ok && scurveRes.data.length > 0) {
            const validData = scurveRes.data.filter(d => d.earned_value_cumulative !== null && d.actual_cost_cumulative !== null);
            const latestData = validData.length > 0 ? validData[validData.length - 1] : null;
            
            if (latestData) {
              const pv = latestData.planned_cost_cumulative || 0;
              const ev = totalBac * (actualWeightedProgress / 100);
              const ac = latestData.actual_cost_cumulative || 0;

              setSpi(pv > 0 ? ev / pv : null);
              setCpi(ac > 0 ? ev / ac : null);
            }
          }
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
  
  const formatYAxis = (val) => {
    if (val === 0) return 'Rp 0';
    if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)} M`;
    return `Rp ${(val / 1000000).toFixed(0)} Jt`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 text-xs">
          <p className="font-bold text-slate-800 mb-2">{label}</p>
          {payload.map((entry, index) => {
            if (entry.value === null || entry.value === undefined) return null;
            return (
              <div key={index} className="flex justify-between items-center gap-4 mb-1">
                <span style={{ color: entry.color }} className="font-semibold">{entry.name}</span>
                <span className="font-mono text-slate-700">{formatRp(entry.value)}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;
  }

  if (!activeProjectId) {
    return <div className="p-10 text-center text-slate-500 font-bold">Silakan pilih proyek di Header terlebih dahulu.</div>;
  }

  const isOverbudget = bac > contractValue && contractValue > 0;

  // FIX Y-AXIS: Membulatkan ke atas ke kelipatan 5 Miliar terdekat
  const maxVal = Math.max(bac, contractValue);
  const yAxisMax = Math.ceil(maxVal / 5000000000) * 5000000000 || 5000000000;

  return (
    <div className="w-full min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-[1920px] mx-auto space-y-6">
        
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dasbor Eksekutif (Waktu Nyata)</h1>
          <p className="text-sm text-slate-500 mt-1">Ringkasan status proyek berdasarkan data aktual lapangan.</p>
        </div>

        {isOverbudget && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={24} />
            <div>
              <h4 className="font-bold">Peringatan Kritis: RAP Melebihi Nilai Kontrak!</h4>
              <p className="text-sm mt-1">Total Anggaran (RAB): <b>{formatRp(bac)}</b> lebih besar dari Nilai Kontrak: <b>{formatRp(contractValue)}</b>. Proyek terindikasi akan mengalami kerugian.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Anggaran (RAB)</p>
              <div className={`p-2 rounded-lg ${isOverbudget ? 'bg-red-50' : 'bg-blue-50'}`}><DollarSign className={isOverbudget ? 'text-red-600' : 'text-blue-600'} size={20} /></div>
            </div>
            <p className={`text-2xl font-bold ${isOverbudget ? 'text-red-600' : 'text-slate-800'}`}>{formatRp(bac)}</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progres Berbobot (EVM)</p>
              <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="text-emerald-600" size={20} /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{weightedProgress.toFixed(2)}%</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kinerja Jadwal (SPI)</p>
              <div className={`p-2 rounded-lg ${spi === null ? 'bg-slate-100' : spi >= 1 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <Activity className={spi === null ? 'text-slate-400' : spi >= 1 ? 'text-emerald-600' : 'text-red-600'} size={20} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${spi === null ? 'text-slate-400' : spi >= 1 ? 'text-slate-800' : 'text-red-600'}`}>
              {spi === null ? 'N/A' : spi.toFixed(2)}
            </p>
            <p className={`text-xs font-semibold mt-1 ${spi === null ? 'text-slate-400' : spi >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
              {spi === null ? 'Belum Ada Jadwal' : spi >= 1 ? 'Sesuai Jadwal' : 'Terlambat'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kinerja Biaya (CPI)</p>
              <div className={`p-2 rounded-lg ${cpi === null ? 'bg-slate-100' : cpi >= 1 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <AlertTriangle className={cpi === null ? 'text-slate-400' : cpi >= 1 ? 'text-emerald-600' : 'text-red-600'} size={20} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${cpi === null ? 'text-slate-400' : cpi >= 1 ? 'text-slate-800' : 'text-red-600'}`}>
              {cpi === null ? 'N/A' : cpi.toFixed(2)}
            </p>
            <p className={`text-xs font-semibold mt-1 ${cpi === null ? 'text-slate-400' : cpi >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
              {cpi === null ? 'Belum Ada Realisasi' : cpi >= 1 ? 'Hemat / Sesuai' : 'Overbudget'}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[500px] flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800">Grafik Kurva S (S-Curve)</h3>
            <p className="text-sm text-slate-500">Visualisasi komparasi Rencana (Plan) vs Aktual (Actual).</p>
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
                  
                  {/* FIX: Domain Y-Axis Dikunci ke yAxisMax */}
                  <YAxis 
                    domain={[0, yAxisMax]} 
                    allowDataOverflow={true}
                    tickFormatter={formatYAxis} 
                    tick={{fontSize: 12, fill: '#64748b'}} 
                    width={90} 
                    axisLine={false} 
                    tickLine={false} 
                    interval="preserveStartEnd"
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="planned_cost_cumulative" name="Rencana (Plan)" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPlan)" />
                  <Line type="monotone" dataKey="actual_cost_cumulative" name="Realisasi Biaya (AC)" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} connectNulls={false} />
                  <Line type="monotone" dataKey="earned_value_cumulative" name="Nilai Hasil (EV)" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={{r: 4}} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <Activity className="w-12 h-12 mb-2 opacity-20" />
                <p className="font-semibold text-slate-500">Belum ada data Kurva S untuk proyek ini.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <ComplianceWidget />
        </div>
      </div>
    </div>
  );
}