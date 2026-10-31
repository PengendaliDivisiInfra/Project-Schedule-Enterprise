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

  const fetchTasks = async (showLoading = true) => {
    if (showLoading) setLoading(true);
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
        setCpmTasks(result.tasks || data);
      } else {
        setCpmTasks([]);
      }
    } catch (err) { console.error(err); } finally { if (showLoading) setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleInlineUpdate = async (taskId, field, value) => {
    try {
      await supabase.from('wbs_tasks').update({ [field]: value }).eq('id', taskId);
      if (field === 'cost' || field === 'mata_varian') fetchTasks(false); // Fetch tanpa loading screen
    } catch (err) {
      alert("Gagal update: " + err.message);
    }
  };

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
      fetchTasks(false); // Fetch ulang di background tanpa loading screen
    } catch (err) { alert('Gagal menyimpan: ' + err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus task ini?')) return;
    try {
      const { error } = await supabase.from('wbs_tasks').delete().eq('id', id);
      if (error) throw error;
      fetchTasks(false);
    } catch (err) { alert('Gagal menghapus: ' + err.message); }
  };

  const handleIndent = async (taskId, currentLevel, type) => {
    let newLevel = currentLevel || 0;
    if (type === 'in' && newLevel < 5) newLevel++;
    if (type === 'out' && newLevel > 0) newLevel--;
    await supabase.from('wbs_tasks').update({ indent_level: newLevel }).eq('id', taskId);
    fetchTasks(false);
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
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? <LoadingSpinner text="Menghitung CPM..." /> : (
          <table className="w-full text-left min-w-[1500px]">
            <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
              <tr>
                <th className="p-3 border-r text-center w-20">Hierarki</th>
                <th className="p-3 border-r text-center w-24">Mata Varian</th>
                <th className="p-3 border-r w-20">WBS</th>
                <th className="p-3 border-r w-48">Nama Task</th>
                <th className="p-3 border-r text-center w-20 text-slate-700 bg-slate-100">Volume</th>
                <th className="p-3 border-r text-center w-20">Durasi</th>
                <th className="p-3 border-r w-28">Start (ES)</th>
                <th className="p-3 border-r w-28">Finish (EF)</th>
                <th className="p-3 border-r text-center w-16">Float</th>
                <th className="p-3 border-r text-right w-32 text-indigo-700 bg-indigo-50">Total Biaya</th>
                <th className="p-3 border-r text-center w-20">Progres</th>
                <th className="p-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {cpmTasks.map((t) => {
                const isSummary = t.summary === 'Yes';
                return (
                  <tr key={t.id} className={`hover:bg-gray-50 ${isSummary ? 'bg-gray-100 font-bold' : ''} ${t.is_critical && !isSummary ? 'text-red-700 bg-red-50' : ''}`}>
                    <td className="p-2 border-r text-center flex justify-center gap-1">
                      <button onClick={() => handleIndent(t.id, t.indent_level, 'out')} disabled={!t.indent_level} className="bg-gray-200 hover:bg-gray-300 px-1 rounded text-xs disabled:opacity-50">⬅️</button>
                      <button onClick={() => handleIndent(t.id, t.indent_level, 'in')} className="bg-gray-200 hover:bg-gray-300 px-1 rounded text-xs">➡️</button>
                    </td>
                    <td className="p-1 border-r text-center">
                       {!isSummary && (
                         <input 
                           type="text" 
                           defaultValue={t.mata_varian || ''} 
                           placeholder="Cth: 7.1(7a)"
                           onBlur={(e) => handleInlineUpdate(t.id, 'mata_varian', e.target.value)}
                           className="w-full border border-transparent hover:border-gray-300 focus:border-blue-500 rounded text-center bg-transparent text-xs font-mono"
                         />
                       )}
                    </td>
                    <td className="p-3 border-r font-mono">{t.wbs_code}</td>
                    <td className="p-3 border-r" style={{ paddingLeft: `${(t.indent_level || 0) * 20 + 12}px` }}>
                      {isSummary ? '📁 ' : '📄 '} {t.name}
                    </td>
                    <td className="p-3 border-r text-center font-bold bg-slate-50">
                      {isSummary ? '-' : `${Number(t.volume) || 0} ${t.ahsp_templates?.unit || ''}`}
                    </td>
                    <td className="p-3 border-r text-center">{t.duration} d</td>
                    <td className="p-3 border-r font-medium">{formatDate(t.start_date)}</td>
                    <td className="p-3 border-r font-medium">{formatDate(t.end_date)}</td>
                    <td className="p-3 border-r text-center font-bold">
                      {isSummary ? '-' : (t.total_float !== undefined ? t.total_float : '-')}
                    </td>
                    <td className="p-1 border-r text-right bg-indigo-50/30">
                      <input 
                        type="number" 
                        defaultValue={Number(t.cost) || 0} 
                        onBlur={(e) => handleInlineUpdate(t.id, 'cost', Number(e.target.value))}
                        disabled={isSummary || !!t.ahsp_template_id}
                        className={`w-full text-right border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded px-1 py-0.5 bg-transparent text-xs font-bold text-indigo-800 ${(isSummary || !!t.ahsp_template_id) ? 'cursor-not-allowed' : ''}`}
                      />
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editingTask} />
    </div>
  );
}
