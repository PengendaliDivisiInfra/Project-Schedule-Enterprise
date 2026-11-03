'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function SCurvePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: viewData } = await supabase.from('v_s_curve_data').select('*');
      if (viewData) setData(viewData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

  if (loading) return <LoadingSpinner text="Memuat Grafik S-Curve..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="text-indigo-600" /> Visualisasi S-Curve (Plan vs Actual)
          </h1>
          <p className="text-sm text-slate-500 mt-1">Perbandingan biaya rencana dan realisasi pengeluaran per bulan.</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{fontSize: 12}} />
              <YAxis tickFormatter={(val) => `Rp ${val / 1000000} Jt`} tick={{fontSize: 12}} width={100} />
              <Tooltip formatter={(value) => formatRp(value)} />
              <Legend />
              <Line type="monotone" dataKey="planned_cost" name="Rencana (Plan)" stroke="#6366f1" strokeWidth={3} dot={{r: 4}} />
              <Line type="monotone" dataKey="actual_cost" name="Aktual (Realisasi)" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}