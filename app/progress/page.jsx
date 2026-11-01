'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ProgressPage() {
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data: taskData } = await supabase.from('wbs_tasks').select('*, ahsp_templates(unit)').order('wbs_code');
    const { data: recordData } = await supabase.from('daily_progress').select('*');
    
    if (taskData) {
      const uniqueTasks = Array.from(new Map(taskData.map(item => [item.wbs_code, item])).values());
      setTasks(uniqueTasks.map(t => ({ ...t, satuan_hsd: t.ahsp_templates?.unit || 'unit', volume: Number(t.volume) || 0 })));
    }
    setRecords(recordData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // REAL-TIME LISTENER
    const channel = supabase.channel('realtime-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_progress' }, () => {
        console.log('🔄 Progress berubah, sinkronisasi...');
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <LoadingSpinner text="Memuat Progress Harian..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-4">Rekapitulasi Progress Harian (Real-Time)</h1>
        <p className="text-sm text-slate-500 mb-6">Halaman ini akan otomatis ter-update jika ada input progres dari perangkat lain.</p>
        
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3 border">WBS</th>
              <th className="p-3 border">Nama Pekerjaan</th>
              <th className="p-3 border text-center">Volume Kontrak</th>
              <th className="p-3 border text-center">Satuan</th>
              <th className="p-3 border text-center">Total Realisasi (Database)</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const taskRecords = records.filter(r => r.task_id === t.id);
              const totalVol = taskRecords.reduce((sum, r) => sum + Number(r.completed_volume), 0);
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="p-3 border font-mono">{t.wbs_code}</td>
                  <td className="p-3 border">{t.name}</td>
                  <td className="p-3 border text-center">{t.volume}</td>
                  <td className="p-3 border text-center">{t.satuan_hsd}</td>
                  <td className="p-3 border text-center font-bold text-blue-600">{totalVol.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
