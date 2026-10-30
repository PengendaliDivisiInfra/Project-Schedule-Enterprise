'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import GanttChart from '../components/GanttChart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        let { data: projects } = await supabase.from('projects').select('id').limit(1);
        let projectId = projects?.[0]?.id;
        if (!projectId) {
          let { data: t } = await supabase.from('wbs_tasks').select('project_id').limit(1);
          projectId = t?.[0]?.project_id;
        }
        if (projectId) {
          const { data } = await supabase.from('wbs_tasks').select('*').eq('project_id', projectId).order('wbs_code', { ascending: true });
          setTasks(data || []);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    loadData();
  }, []);

  // Logika S-Curve Sederhana (Cumulative PV, EV, AC per Minggu)
  const generateSCurveData = () => {
    const leafTasks = tasks.filter(t => t.summary !== 'Yes' && t.start_date && t.end_date);
    if (leafTasks.length === 0) return [];

    let minDate = new Date(leafTasks[0].start_date);
    let maxDate = new Date(leafTasks[0].end_date);
    let totalBAC = 0;

    leafTasks.forEach(t => {
      const s = new Date(t.start_date);
      const f = new Date(t.end_date);
      if (s < minDate) minDate = s;
      if (f > maxDate) maxDate = f;
      totalBAC += Number(t.cost) || 0;
    });

    const data = [];
    let currentDate = new Date(minDate);
    let cumulativePV = 0;
    let cumulativeEV = 0;
    let cumulativeAC = 0;

    while (currentDate <= maxDate) {
      let weeklyPV = 0;
      let weeklyEV = 0;
      
      leafTasks.forEach(t => {
        const cost = Number(t.cost) || 0;
        const progress = Number(t.progress_percent) || 0;
        const s = new Date(t.start_date);
        const f = new Date(t.end_date);
        const duration = Math.max(1, (f - s) / (1000 * 60 * 60 * 24));

        // Kalkulasi PV (Linear)
        if (currentDate >= f) weeklyPV += cost;
        else if (currentDate >= s) {
          const elapsed = (currentDate - s) / (1000 * 60 * 60 * 24);
          weeklyPV += cost * Math.min(1, elapsed / duration);
        }

        // Kalkulasi EV (Berdasarkan progres saat ini - disederhanakan)
        if (currentDate >= s) {
          weeklyEV += cost * (progress / 100);
        }
      });

      // Kalkulasi AC diasumsikan sama dengan EV untuk demo
      const weeklyAC = weeklyEV; 

      cumulativePV = weeklyPV;
      cumulativeEV = weeklyEV;
      cumulativeAC = weeklyAC;

      data.push({
        name: currentDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        PV: Math.round(cumulativePV),
        EV: Math.round(cumulativeEV),
        AC: Math.round(cumulativeAC),
      });

      currentDate.setDate(currentDate.getDate() + 7); // Interval 7 hari
    }
    return data;
  };

  const scurveData = generateSCurveData();

  return (
    <div>
      <div className="mb-6 flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proyek Jembatan Cisomang (Enterprise)</h1>
          <p className="text-sm text-gray-500 mt-1">Status Date: {new Date().toLocaleDateString('id-ID')} | User: engineering@gmail.com</p>
        </div>
        <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm flex items-center gap-2">
          Recalculate CPM & AHSP
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 font-bold mb-2 tracking-wider">RAB PROJECT (BAC)</div>
          <div className="text-2xl font-bold text-gray-800">Rp {tasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0).toLocaleString('id-ID')}</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 font-bold mb-2 tracking-wider">SPI</div>
          <div className="text-2xl font-bold text-gray-800">1.000</div>
          <div className="text-xs text-green-600 font-medium mt-1">Sesuai Jadwal</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 font-bold mb-2 tracking-wider">CPI</div>
          <div className="text-2xl font-bold text-gray-800">1.000</div>
          <div className="text-xs text-green-600 font-medium mt-1">Hemat</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 font-bold mb-2 tracking-wider">EAC</div>
          <div className="text-2xl font-bold text-gray-800">Rp {tasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0).toLocaleString('id-ID')}</div>
        </div>
      </div>

      {/* Grafik S-Curve */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4">S-Curve (PV / EV / AC)</h2>
        <div className="h-[300px] w-full">
          {loading ? <div className="text-center pt-20 text-gray-500">Memuat Grafik...</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scurveData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tickFormatter={(value) => `Rp ${value/1000000}M`} tick={{fontSize: 12}} />
                <Tooltip formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} />
                <Legend />
                <Line type="monotone" dataKey="PV" name="Planned Value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="EV" name="Earned Value" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="AC" name="Actual Cost" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gantt Chart Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-5 border-b border-gray-200 bg-gray-50/50 rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-800">Interactive Gantt Workspace (CPM Engine)</h2>
        </div>
        <div className="p-5">
          {loading ? <div className="text-center text-gray-500 py-10">Memuat Gantt Chart...</div> : <GanttChart tasks={tasks} />}
        </div>
      </div>
    </div>
  );
}
