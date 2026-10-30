'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let { data: projects } = await supabase.from('projects').select('id').limit(1);
      let pid = projects?.[0]?.id;
      if (!pid) {
        let { data: tData } = await supabase.from('wbs_tasks').select('project_id').limit(1);
        pid = tData?.[0]?.project_id;
      }
      if (!pid) pid = '00000000-0000-0000-0000-000000000000';
      setProjectId(pid);
      
      // Gunakan wbs_code untuk sorting
      const { data } = await supabase.from('wbs_tasks').select('*').eq('project_id', pid).order('wbs_code', { ascending: true });
      setTasks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleSeedData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Gunakan properti wbs_code sesuai database
      const dummyTasks = [
        { project_id: projectId, wbs_code: '1', name: 'Pekerjaan Persiapan', summary: 'Yes', start_date: '2026-10-01', end_date: '2026-10-31' },
        { project_id: projectId, wbs_code: '1.1', name: 'Mobilisasi & Demobilisasi', summary: 'No', start_date: '2026-10-01', end_date: '2026-10-07', duration: 6, progress_percent: 100 },
        { project_id: projectId, wbs_code: '1.2', name: 'Direksi Keet & Gudang', summary: 'No', start_date: '2026-10-05', end_date: '2026-10-15', duration: 10, progress_percent: 50 },
        { project_id: projectId, wbs_code: '2', name: 'Pekerjaan Tanah & Pondasi', summary: 'Yes', start_date: '2026-10-15', end_date: '2026-11-15' },
        { project_id: projectId, wbs_code: '2.1', name: 'Galian Tanah Pondasi', summary: 'No', start_date: '2026-10-16', end_date: '2026-10-25', duration: 9, progress_percent: 0 },
        { project_id: projectId, wbs_code: '2.2', name: 'Cor Beton Pondasi', summary: 'No', start_date: '2026-10-26', end_date: '2026-11-10', duration: 15, progress_percent: 0 },
      ];
      
      // Coba insert. Jika error karena constraint, tangkap errornya
      const { error } = await supabase.from('wbs_tasks').insert(dummyTasks);
      if (error) throw error;
      
      await fetchTasks();
      alert('Data Dummy Berhasil Dibuat!');
    } catch (err) {
      alert('Gagal membuat data dummy: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Management (WBS)</h1>
        {tasks.length === 0 && (
          <button onClick={handleSeedData} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition">
            + Generate Data Dummy
          </button>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b text-sm">
            <tr>
              <th className="p-4">WBS</th>
              <th className="p-4">Nama Task</th>
              <th className="p-4">Start</th>
              <th className="p-4">Finish</th>
              <th className="p-4">Progress</th>
              <th className="p-4">Cost</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {tasks.map((t) => (
              <tr key={t.id} className={`border-b hover:bg-gray-50 ${t.summary === 'Yes' ? 'bg-gray-100 font-bold' : ''}`}>
                <td className="p-4">{t.wbs_code}</td>
                <td className="p-4">{t.name}</td>
                <td className="p-4">{t.start_date}</td>
                <td className="p-4">{t.end_date}</td>
                <td className="p-4">{t.progress_percent}%</td>
                <td className="p-4">Rp {t.cost?.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && !loading && (
          <div className="p-10 text-center text-gray-500">
            {/* Perbaikan tanda kutip ESLint */}
            Database Tasks kosong. Klik tombol &quot;+ Generate Data Dummy&quot; di atas untuk mencoba fitur Gantt Chart.
          </div>
        )}
        {loading && <div className="p-6 text-center text-blue-500">Memproses data...</div>}
      </div>
    </div>
  );
}
