'use client';
import { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useProject } from '../../context/ProjectContext';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useProject } from '../../context/ProjectContext';
import { TrendingUp, AlertCircle } from 'lucide-react';

import { useProject } from '../../context/ProjectContext';
export default function SCurvePage() {
  const { activeProjectId } = useProject();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: viewData } = await supabase.from('v_s_curve_data').select('*').eq('project_id', activeProjectId);
      if (viewData) setData(viewData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  const formatYAxis = (val) => `Rp ${(val / 1000000).toFixed(0)} Jt`;

  // Mengambil nilai terakhir untuk Summary Card
  const latestData = data.length > 0 ? data[data.length - 1] : null;

  if (loading) return <LoadingSpinner text="Memuat Grafik S-Curve..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="text-indigo-600" /> Visualisasi S-Curve (Plan vs Actual)
          </h1>
          <p className="text-sm text-slate-500 mt-1">Perbandingan kumulatif biaya rencana dan realisasi pengeluaran per bulan.</p>
        </div>

        {/* Summary Cards */}
        {latestData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-l-indigo-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Rencana (Plan)</p>
              <p className="text-xl font-bold text-indigo-600">{formatRp(latestData.planned_cost_cumulative)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-l-red-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Realisasi (Actual)</p>
              <p className="text-xl font-bold text-red-600">{formatRp(latestData.actual_cost_cumulative)}</p>
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-[550px] relative">
          {data.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <AlertCircle size={48} className="mb-4 opacity-50" />
              <p>Belum ada data perencanaan atau realisasi untuk ditampilkan.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatYAxis} tick={{fontSize: 12, fill: '#64748b'}} width={90} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => formatRp(value)} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                
                {/* Area untuk Rencana */}
                <Area type="monotone" dataKey="planned_cost_cumulative" name="Rencana (Plan)" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPlan)" />
                
                {/* Line untuk Aktual */}
                <Line type="monotone" dataKey="actual_cost_cumulative" name="Realisasi (Aktual)" stroke="#ef4444" strokeWidth={3} dot={{r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 7}} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}