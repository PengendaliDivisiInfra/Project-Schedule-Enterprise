'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Link from 'next/link';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase.from('wbs_tasks').select('*, ahsp_templates(unit)').order('wbs_code');
    if (data) {
      const uniqueTasks = Array.from(new Map(data.map(item => [item.wbs_code, item])).values());
      setTasks(uniqueTasks.map(t => ({
        ...t,
        satuan_hsd: t.ahsp_templates?.unit || 'unit',
        volume: Number(t.volume) || 0,
        cost: Number(t.cost) || 0
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleDelete = async (id) => {
    if (confirm("Hapus task ini beserta anak-anaknya?")) {
      await supabase.from('wbs_tasks').delete().eq('id', id);
      fetchTasks();
    }
  };

  if (loading) return <LoadingSpinner text="Memuat Tasks..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Task Management (CPM Engine)</h1>
            <p className="text-sm text-slate-500">Warna <span className="text-red-500 font-bold">Merah</span> menandakan Jalur Kritis.</p>
          </div>
          <Link href="/tasks/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow">
            + Tambah Task
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Hierarki</th>
                <th className="p-3">Mata Varian</th>
                <th className="p-3">WBS</th>
                <th className="p-3">Nama Task</th>
                <th className="p-3">Volume</th>
                <th className="p-3">Harga Satuan</th>
                <th className="p-3">Total Biaya</th>
                <th className="p-3">Durasi</th>
                <th className="p-3">Start (ES)</th>
                <th className="p-3">Finish (EF)</th>
                <th className="p-3 text-center">Progres</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((t, idx) => {
                const isSummary = t.summary === 'Yes';
                return (
                  <tr key={t.id} className={`hover:bg-slate-50 ${isSummary ? 'bg-slate-50/50 font-bold' : ''} ${t.is_critical ? 'text-red-600' : 'text-slate-700'}`}>
                    <td className="p-3">{isSummary ? '📁' : '📄'}</td>
                    <td className="p-3 text-xs text-slate-500">{isSummary ? '-' : t.mata_varian || '-'}</td>
                    <td className="p-3 font-mono">{t.wbs_code}</td>
                    <td className="p-3">{t.name}</td>
                    <td className="p-3">{isSummary ? '-' : `${t.volume} ${t.satuan_hsd}`}</td>
                    <td className="p-3">{isSummary ? '-' : `Rp ${Number(t.cost / (t.volume || 1)).toLocaleString('id-ID')}`}</td>
                    <td className="p-3 font-semibold">{isSummary ? '-' : `Rp ${Number(t.cost).toLocaleString('id-ID')}`}</td>
                    <td className="p-3">{t.duration} d</td>
                    <td className="p-3">{t.start_date ? new Date(t.start_date).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="p-3">{t.end_date ? new Date(t.end_date).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="p-3">
                       <div className="w-full bg-slate-200 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full ${t.is_critical ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${t.progress_percent || 0}%` }}></div>
                       </div>
                       <span className="text-xs text-center block mt-1">{t.progress_percent || 0}%</span>
                    </td>
                    <td className="p-3 text-center text-blue-600 font-medium text-xs whitespace-nowrap">
                      <Link href={`/tasks/edit/${t.id}`} className="hover:underline">Edit</Link> | 
                      <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:underline ml-1">Hapus</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
