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
      
      const { data } = await supabase.from('wbs_tasks').select(`
        *,
        ahsp_templates ( unit, total_harga_ahsp )
      `).eq('project_id', pid).order('wbs_code', { ascending: true });
      
      if (data && data.length > 0) {
        const mappedData = data.map(t => {
          // Harga Satuan: Prioritaskan dari AHSP, jika kosong hitung dari Cost/Volume
          const hargaSatuan = Number(t.ahsp_templates?.total_harga_ahsp) || (Number(t.volume) > 0 ? (Number(t.cost) / Number(t.volume)) : 0);
          return {
            ...t,
            satuan_hsd: t.ahsp_templates?.unit || 'unit',
            harga_satuan: hargaSatuan,
            // Pastikan cost selalu Volume * Harga Satuan
            cost: Number(t.volume) * hargaSatuan
          };
        });

        const projectStart = data[0].start_date || new Date().toISOString().split('T')[0];
        const result = calculateCPM(mappedData, projectStart);
        setCpmTasks(result.tasks || mappedData);
      } else {
        setCpmTasks([]);
      }
    } catch (err) { console.error(err); } finally { if (showLoading) setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  // Hitung Total Otomatis saat Volume Berubah
  const handleUpdateVolume = async (task, newVolume) => {
    const vol = Number(newVolume);
    if (isNaN(vol) || vol < 0) return;

    const hargaSatuan = task.harga_satuan || 0;
    const newTotalCost = vol * hargaSatuan;

    try {
      const { error } = await supabase.from('wbs_tasks').update({ 
        volume: vol,
        cost: newTotalCost 
      }).eq('id', task.id);
      
      if (error) throw error;
      fetchTasks(false);
    } catch (err) {
      alert("Gagal update volume: " + err.message);
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
      fetchTasks(false);
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
          <table className="w-full text-left min-w-[1600px]">
            <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
              <tr>
                <th className="p-3 border-r text-center w-20">Hierarki</th>
                <th className="p-3 border-r text-center w-24">Mata Varian</th>
                <th className="p-3 border-r w-16">WBS</th>
                <th className="p-3 border-r w-48">Nama Task</th>
                <th className="p-3 border-r text-center w-24 text-slate-700 bg-slate-100">Volume</th>
                <th className="p-3 border-r text-right w-28 text-blue-700 bg-blue-50">Harga Satuan</th>
                <th className="p-3 border-r text-right w-32 text-indigo-700 bg-indigo-50">Total Biaya</th>
                <th className="p-3 border-r text-center w-16">Durasi</th>
                <th className="p-3 border-r w-28">Start (ES)</th>
                <th className="p-3 border-r w-28">Finish (EF)</th>
                <th className="p-3 border-r text-center w-16">Float</th>
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
                           placeholder="Cth: 1.2"
                           onBlur={(e) => supabase.from('wbs_tasks').update({mata_varian: e.target.value}).eq('id', t.id).then(() => fetchTasks(false))}
                           className="w-full border border-transparent hover:border-gray-300 focus:border-blue-500 rounded text-center bg-transparent text-xs font-mono"
                         />
                       )}
                    </td>
                    <td className="p-3 border-r font-mono">{t.wbs_code}</td>
                    <td className="p-3 border-r" style={{ paddingLeft: `${(t.indent_level || 0) * 20 + 12}px` }}>
                      {isSummary ? '📁 ' : '📄 '} {t.name}
                    </td>
                    
                    <td className="p-1 border-r text-center font-bold bg-slate-50">
                      {!isSummary && (
                        <div className="flex items-center gap-1 justify-center">
                          <input 
                            type="number" 
                            defaultValue={t.volume || 0} 
                            onBlur={(e) => handleUpdateVolume(t, e.target.value)}
                            className="w-16 text-center border border-transparent hover:border-gray-300 focus:border-blue-500 rounded bg-transparent text-xs font-bold"
                          />
                          <span className="text-[10px] text-gray-500">{t.satuan_hsd}</span>
                        </div>
                      )}
                    </td>

                    <td className="p-3 border-r text-right font-semibold text-blue-700 bg-blue-50/50">
                      {isSummary ? '-' : `Rp ${(t.harga_satuan || 0).toLocaleString('id-ID')}`}
                    </td>

                    <td className="p-3 border-r text-right font-bold text-indigo-800 bg-indigo-50/50">
                      {isSummary ? `Rp ${(t.cost || 0).toLocaleString('id-ID')}` : `Rp ${(Number(t.cost) || 0).toLocaleString('id-ID')}`}
                    </td>

                    <td className="p-3 border-r text-center">{t.duration} d</td>
                    <td className="p-3 border-r font-medium">{formatDate(t.start_date)}</td>
                    <td className="p-3 border-r font-medium">{formatDate(t.end_date)}</td>
                    <td className="p-3 border-r text-center font-bold">
                      {isSummary ? '-' : (t.total_float !== undefined ? t.total_float : '-')}
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
