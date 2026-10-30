'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import TaskModal from '../../components/TaskModal';
import LoadingSpinner from '../../components/LoadingSpinner';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
      let pid = projects?.[0]?.id || '00000000-0000-0000-0000-000000000000';
      setProjectId(pid);
      
      const { data } = await supabase.from('wbs_tasks').select('*').eq('project_id', pid).order('wbs_code', { ascending: true });
      setTasks(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleSave = async (formData) => {
    try {
      if (editingTask) {
        const payload = editingTask.ahsp_template_id ? { ...formData, cost: editingTask.cost } : formData;
        const { error } = await supabase.from('wbs_tasks').update(payload).eq('id', editingTask.id);
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

  // Fungsi Indent & Outdent
  const handleIndent = async (taskId, currentLevel, type) => {
    let newLevel = currentLevel || 0;
    if (type === 'in' && newLevel < 5) newLevel++;
    if (type === 'out' && newLevel > 0) newLevel--;
    
    try {
      await supabase.from('wbs_tasks').update({ indent_level: newLevel }).eq('id', taskId);
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Management (MS Project Engine)</h1>
        <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition shadow-sm">
          + Tambah Task
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? <LoadingSpinner text="Memuat data Task..." /> : (
          <table className="w-full text-left min-w-[1200px]">
            <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
              <tr>
                <th className="p-3 border-r text-center w-24">Hierarki</th>
                <th className="p-3 border-r">WBS</th>
                <th className="p-3 border-r">Nama Task</th>
                <th className="p-3 border-r text-center">Durasi</th>
                <th className="p-3 border-r">Start</th>
                <th className="p-3 border-r">Finish</th>
                <th className="p-3 border-r">Predecessors</th>
                <th className="p-3 border-r">Mode</th>
                <th className="p-3 border-r text-center">Progres</th>
                <th className="p-3 border-r">Biaya</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {tasks.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-50 ${t.summary === 'Yes' ? 'bg-gray-100 font-bold' : ''}`}>
                  
                  {/* Kolom Interaktif Indent/Outdent */}
                  <td className="p-2 border-r text-center flex justify-center gap-1">
                    <button onClick={() => handleIndent(t.id, t.indent_level, 'out')} disabled={!t.indent_level} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-xs disabled:opacity-50" title="Outdent (Kurangi Indent)">⬅️</button>
                    <button onClick={() => handleIndent(t.id, t.indent_level, 'in')} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-xs" title="Indent (Tambah Indent)">➡️</button>
                  </td>

                  <td className="p-3 border-r font-mono">{t.wbs_code}</td>
                  <td className="p-3 border-r" style={{ paddingLeft: `${(t.indent_level || 0) * 20 + 12}px` }}>
                    {t.summary === 'Yes' ? '📁 ' : '📄 '} {t.name}
                  </td>
                  <td className="p-3 border-r text-center">{t.duration} d</td>
                  <td className="p-3 border-r text-gray-600">{formatDate(t.start_date)}</td>
                  <td className="p-3 border-r text-gray-600">{formatDate(t.end_date)}</td>
                  <td className="p-3 border-r text-gray-500">{t.predecessors || '-'}</td>
                  <td className="p-3 border-r text-xs text-gray-500">{t.task_mode === 'Auto Scheduled' ? 'Auto' : 'Manual'}</td>
                  <td className="p-3 border-r text-center">{t.progress_percent}%</td>
                  <td className="p-3 border-r">
                    Rp {(t.cost || 0).toLocaleString('id-ID')}
                    {t.ahsp_template_id && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded" title="Auto AHSP">Auto</span>}
                  </td>
                  <td className="p-3 flex justify-center gap-2">
                    <button onClick={() => { setEditingTask(t); setIsModalOpen(true); }} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tasks.length === 0 && !loading && <div className="p-10 text-center text-gray-500">Belum ada data task.</div>}
      </div>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editingTask} />
    </div>
  );
}
