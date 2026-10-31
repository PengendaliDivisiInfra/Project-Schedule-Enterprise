'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import GanttChart from '../components/GanttChart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateCPM } from '../lib/cpmEngine';
import { generateEVMData } from '../lib/evmEngine';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scurveData, setScurveData] = useState([]);
  const [kpi, setKpi] = useState({ bac: 0, spi: 1, cpi: 1, etc: 0, eac: 0, vac: 0, tcpi: 1 });
  const statusDate = new Date().toISOString().split('T')[0];

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
          const { data: records } = await supabase.from('daily_progress').select('*').lte('record_date', statusDate);
          
          if (data && data.length > 0) {
            const projectStart = data[0].start_date || new Date().toISOString().split('T')[0];
            const cpmResult = calculateCPM(data, projectStart);
            
            if (!cpmResult.error) {
              setTasks(cpmResult.tasks);
              const evm = generateEVMData(cpmResult.tasks, projectStart, statusDate, records || []);
              setScurveData(evm.chartData);
              setKpi(evm.summaryKPI);
            } else {
              setTasks(data);
            }
          }
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    loadData();
  }, [statusDate]);

  const formatRp = (val) => "Rp " + (val || 0).toLocaleString('id-ID');
  const formatPercent = (val) => (val || 1).toFixed(3);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proyek Jembatan Cisomang (Enterprise)</h1>
          <p className="text-sm text-gray-500 mt-1">Status Date: {statusDate} | User: engineering@gmail.com</p>
        </div>
        <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">Recalculate CPM & EVM</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><div className="text-[10px] text-gray-500 font-bold mb-1 tracking-wider uppercase">BAC</div><div className="text-lg font-bold text-gray-800">{formatRp(kpi.bac)}</div></div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><div className="text-[10px] text-gray-500 font-bold mb-1 tracking-wider uppercase">SPI</div><div className={`text-lg font-bold ${kpi.spi >= 1 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(kpi.spi)}</div></div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><div className="text-[10px] text-gray-500 font-bold mb-1 tracking-wider uppercase">CPI</div><div className={`text-lg font-bold ${kpi.cpi >= 1 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(kpi.cpi)}</div></div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><div className="text-[10px] text-gray-500 font-bold mb-1 tracking-wider uppercase">ETC</div><div className="text-lg font-bold text-gray-800">{formatRp(kpi.etc)}</div></div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><div className="text-[10px] text-gray-500 font-bold mb-1 tracking-wider uppercase">EAC</div><div className="text-lg font-bold text-gray-800">{formatRp(kpi.eac)}</div></div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><div className="text-[10px] text-gray-500 font-bold mb-1 tracking-wider uppercase">VAC</div><div className={`text-lg font-bold ${kpi.vac >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatRp(kpi.vac)}</div></div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><div className="text-[10px] text-gray-500 font-bold mb-1 tracking-wider uppercase">TCPI</div><div className={`text-lg font-bold ${kpi.tcpi <= 1 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(kpi.tcpi)}</div></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4">S-Curve (PV / EV / AC)</h2>
        <div className="h-[350px] w-full">
          {loading ? <div className="text-center pt-20 text-gray-500">Memuat Grafik...</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scurveData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tickFormatter={(value) => `Rp ${(value/1000000).toFixed(1)}M`} tick={{fontSize: 12}} />
                <Tooltip formatter={(value) => value ? `Rp ${value.toLocaleString('id-ID')}` : '-'} />
                <Legend />
                <Line type="monotone" dataKey="PV" name="Planned Value" stroke="#3b82f6" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="EV" name="Earned Value" stroke="#10b981" strokeWidth={3} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="AC" name="Actual Cost" stroke="#ef4444" strokeWidth={3} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-5 border-b border-gray-200 bg-gray-50/50 rounded-t-xl"><h2 className="text-lg font-bold text-gray-800">Interactive Gantt Workspace (CPM Engine)</h2></div>
        <div className="p-5">{loading ? <div className="text-center text-gray-500 py-10">Memuat Gantt Chart...</div> : <GanttChart tasks={tasks} />}</div>
      </div>
    </div>
  );
}
