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
          const { data } = await supabase.from('wbs_tasks').select('*').eq('project_id', projectId).order('wbs', { ascending: true });
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
      {/* Header */}
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-lg shadow border-l-4 border-blue-600">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proyek Konstruksi (Enterprise)</h1>
          <p className="text-sm text-gray-500">Status Date: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          Recalculate CPM & AHSP
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-gray-500 font-semibold mb-1">RAB PROJECT (BAC)</div>
          <div className="text-xl font-bold text-gray-800">Rp 32.175.000</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-gray-500 font-semibold mb-1">SPI</div>
          <div className="text-xl font-bold text-gray-800">1.000 <span className="text-sm font-normal text-green-600">Sesuai Jadwal</span></div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-gray-500 font-semibold mb-1">CPI</div>
          <div className="text-xl font-bold text-gray-800">1.000 <span className="text-sm font-normal text-green-600">Hemat</span></div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-gray-500 font-semibold mb-1">EAC</div>
          <div className="text-xl font-bold text-gray-800">Rp 32.175.000</div>
        </div>
      </div>

      {/* Gantt Chart Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Interactive Gantt Workspace (CPM Engine)</h2>
        </div>
        <div className="p-4">
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
