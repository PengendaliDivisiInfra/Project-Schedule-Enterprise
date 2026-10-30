'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import GanttChart from '../components/GanttChart';

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div>
      <div className="mb-6 flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proyek Jembatan Cisomang (Enterprise)</h1>
          <p className="text-sm text-gray-500 mt-1">Status Date: 30/10/2026 | User: engineering@gmail.com</p>
        </div>
        <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Recalculate CPM & AHSP
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 font-bold mb-2 tracking-wider">RAB PROJECT (BAC)</div>
          <div className="text-2xl font-bold text-gray-800">Rp 32.175.000</div>
          <div className="text-xs text-gray-400 mt-1">Budget at Completion</div>
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
          <div className="text-2xl font-bold text-gray-800">Rp 32.175.000</div>
          <div className="text-xs text-gray-400 mt-1">VAC: Rp 0</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            Interactive Gantt Workspace (CPM Engine)
          </h2>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="text-center text-gray-500 py-10">Memuat Gantt Chart...</div>
          ) : (
            <GanttChart tasks={tasks} />
          )}
        </div>
      </div>
    </div>
  );
}
