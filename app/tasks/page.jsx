'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import TaskModal from '../../components/TaskModal';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

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
      
      const { data } = await supabase.from('wbs_tasks').select('*').eq('project_id', pid).order('wbs_code', { ascending: true });
      setTasks(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleSave = async (formData) => {
    try {
      if (editingTask) {
        const { error } = await supabase.from('wbs_tasks').update(formData).eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('wbs_tasks').insert([{ ...formData, project_id: projectId }]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err) { alert('Gagal menyimpan: ' + err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus task ini?')) return;
    try {
      const { error } = await supabase.from('wbs_tasks').delete().eq('id', id);
      if (error) throw error;
      fetchTasks();
    } catch (err) { alert('Gagal menghapus: ' + err.message); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Management (WBS)</h1>
        <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition shadow-sm">
          + Tambah Task
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
            <tr>
              <th className="p-4">WBS</th>
              <th className="p-4">Nama Task</th>
              <th className="p-4">Start</th>
              <th className="p-4">Finish</th>
              <th className="p-4">Progres</th>
              <th className="p-4">Biaya</th>
              <th className="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100">
            {tasks.map((t) => (
              <tr key={t.id} className={`hover:bg-gray-50 ${t.summary === 'Yes' ? 'bg-gray-100 font-bold' : ''}`}>
                <td className="p-4 font-mono">{t.wbs_code}</td>
                <td className="p-4">{t.name}</td>
                <td className="p-4 text-gray-500">{t.start_date}</td>
                <td className="p-4 text-gray-500">{t.end_date}</td>
                <td className="p-4">{t.progress_percent}%</td>
                <td className="p-4">Rp {t.cost?.toLocaleString('id-ID')}</td>
                <td className="p-4 flex justify-center gap-2">
                  <button onClick={() => { setEditingTask(t); setIsModalOpen(true); }} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:underline text-xs font-medium">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && !loading && <div className="p-10 text-center text-gray-500">Belum ada data task. Silakan tambah task baru.</div>}
        {loading && <div className="p-6 text-center text-blue-500">Memuat data...</div>}
      </div>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editingTask} />
    </div>
  );
}
