'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import TaskModal from '../../components/TaskModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { calculateCPM } from '../../lib/cpmEngine';

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function TasksPage() {
  const [cpmTasks, setCpmTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [engineError, setEngineError] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    setEngineError(null);
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
      
      if (data && data.length > 0) {
        const projectStart = data[0].start_date || new Date().toISOString().split('T')[0];
        const result = calculateCPM(data, projectStart);
        
        if (result.error) {
          setEngineError(result.error);
          setCpmTasks(result.tasks);
        } else {
          setCpmTasks(result.tasks);
        }
      } else {
        setCpmTasks([]);
      }
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

  const handleIndent = async (taskId, currentLevel, type) => {
    let newLevel = currentLevel || 0;
    if (type === 'in' && newLevel < 5) newLevel++;
    if (type === 'out' && newLevel > 0) newLevel--;
    await supabase.from('wbs_tasks').update({ indent_level: newLevel }).eq('id', taskId);
    fetchTasks();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Task Management (CPM Engine)</h1>
          <p className="text-sm text-gray-500 mt-1">Warna <span className="text-red-600 font-bold">Merah</span> menandakan Jalur Kritis.</p>
        </div>
        <button onClick={() => { setEditingTask(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition shadow-sm">
          + Tambah Task
        </button>
      </div>

      {engineError && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 border border-red-300 font-bold">
          ⚠️ {engineError}
        </div>
      )}
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? <LoadingSpinner text="Menghitung CPM..." /> : (
          <table className="w-full text-left min-w-[1300px]">
            <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
              <tr>
                <th className="p-3 border-r text-center w-24">Hierarki</th>
                <th className="p-3 border-r">WBS</th>
                <th className="p-3 border-r">Nama Task</th>
                <th className="p-3 border-r text-center">Durasi</th>
                <th className="p-3 border-r">Start (ES)</th>
                <th className="p-3 border-r">Finish (EF)</th>
                <th className="p-3 border-r">Predecessors</th>
                <th className="p-3 border-r text-center">Float</th>
                <th className="p-3 border-r text-center">Progres</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {cpmTasks.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-50 ${t.summary === 'Yes' ? 'bg-gray-100 font-bold' : ''} ${t.is_critical && t.summary !== 'Yes' ? 'text-red-700 bg-red-50' : ''}`}>
                  <td className="p-2 border-r text-center flex justify-center gap-1">
                    <button onClick={() => handleIndent(t.id, t.indent_level, 'out')} disabled={!t.indent_level} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-xs disabled:opacity-50">⬅️</button>
                    <button onClick={() => handleIndent(t.id, t.indent_level, 'in')} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-xs">➡️</button>
                  </td>
                  <td className="p-3 border-r font-mono">{t.wbs_code}</td>
                  <td className="p-3 border-r" style={{ paddingLeft: `${(t.indent_level || 0) * 20 + 12}px` }}>
                    {t.summary === 'Yes' ? '📁 ' : '📄 '} {t.name}
                  </td>
                  <td className="p-3 border-r text-center">{t.duration} d</td>
                  <td className="p-3 border-r font-medium">{formatDate(t.start_date)}</td>
                  <td className="p-3 border-r font-medium">{formatDate(t.end_date)}</td>
                  <td className="p-3 border-r text-gray-500 text-xs">{t.predecessors || '-'}</td>
                  <td className="p-3 border-r text-center font-bold">
                    {t.summary === 'Yes' ? '-' : (t.total_float !== undefined ? t.total_float : '-')}
                  </td>
                  <td className="p-3 border-r text-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                      <div className={`h-2.5 rounded-full ${t.is_critical ? 'bg-red-600' : 'bg-blue-600'}`} style={{ width: `${t.progress_percent}%` }}></div>
                    </div>
                    {t.progress_percent}%
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
        {cpmTasks.length === 0 && !loading && <div className="p-10 text-center text-gray-500">Belum ada data task.</div>}
      </div>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editingTask} />
    </div>
  );
}
