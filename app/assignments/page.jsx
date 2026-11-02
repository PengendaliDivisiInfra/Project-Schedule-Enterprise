'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CheckCircle2, AlertTriangle, Loader2, Link as LinkIcon } from 'lucide-react';

export default function AssignmentsPage() {
  const [tasks, setTasks] = useState([]);
  const [ahspList, setAhspList] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch AHSP Templates untuk dropdown
      const { data: ahspData, error: ahspError } = await supabase
        .from('ahsp_templates')
        .select('id, kode_ahsp, name, unit')
        .order('name');
      
      if (ahspError) throw ahspError;
      setAhspList(ahspData || []);

      // 2. Fetch WBS Tasks
      const { data: taskData, error: taskError } = await supabase
        .from('wbs_tasks')
        .select('id, wbs_code, name, volume, ahsp_template_id, summary')
        .order('wbs_code');
      
      if (taskError) throw taskError;
      
      // Saring duplikat
      const uniqueTasks = Array.from(new Map(taskData.map(item => [item.wbs_code, item])).values());
      setTasks(uniqueTasks);

      // 3. Fetch Task Assignments (Untuk melihat resource otomatis)
      const { data: assignData } = await supabase
        .from('task_assignments')
        .select('task_id, project_resources(name, role)');
      if (assignData) setAssignments(assignData);

      // 3. Fetch Task Assignments (Untuk melihat resource otomatis)
      const { data: assignData } = await supabase
        .from('task_assignments')
        .select('task_id, project_resources(name, role)');
      if (assignData) setAssignments(assignData);

    } catch (error) {
      console.error("Gagal fetch data:", error);
      showToast('danger', "Gagal memuat data: " + error.message);
    } finally {
      setLoading(false); // Selalu matikan loading, apapun yang terjadi
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

    const handleUpdateVolume = async (taskId, newVolume) => {
    const numVolume = Number(newVolume) || 0;
    
    // Optimistic UI
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, volume: numVolume } : t));

    const { error } = await supabase
      .from('wbs_tasks')
      .update({ volume: numVolume })
      .eq('id', taskId);

    if (error) {
      showToast('danger', "Gagal update volume: " + error.message);
    } else {
      showToast('success', "Volume berhasil diperbarui!");
    }
  };

  const handleAssignAhsp = async (taskId, ahspId) => {
    setSavingId(taskId); // Tampilkan spinner di baris ini saja
    
    // Update state optimis
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ahsp_template_id: ahspId || null } : t));

    const { error } = await supabase
      .from('wbs_tasks')
      .update({ ahsp_template_id: ahspId || null })
      .eq('id', taskId);

    if (error) {
      showToast('danger', "Gagal menyimpan assignment: " + error.message);
      fetchData(); // Rollback jika gagal
    } else {
      showToast('success', "AHSP berhasil di-assign!");
    }
    
    setSavingId(null);
  };

  if (loading) return <LoadingSpinner text="Memuat Data Assignment..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <LinkIcon className="text-blue-600" /> Assignment: WBS ke AHSP
          </h1>
          <p className="text-sm text-slate-500 mt-1">Hubungkan setiap Item Pekerjaan (WBS) dengan Analisa Harga Satuan (AHSP) yang sesuai.</p>
        </div>

        {/* TABEL DATA */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 w-20">WBS</th>
                <th className="p-3">Nama Task</th>
                <th className="p-3 w-32 text-center">Volume</th>
                <th className="p-3 w-96">Pilih AHSP Template</th>
                <th className="p-3 w-16 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500 italic">Belum ada data WBS.</td>
                </tr>
              )}
              
              {tasks.map((t) => {
                const isSummary = t.summary === 'Yes';
                const isSaving = savingId === t.id;
                const assignedAhsp = ahspList.find(a => a.id === t.ahsp_template_id);

                return (
                  <tr key={t.id} className={`hover:bg-slate-50 ${isSummary ? 'bg-slate-50/50 font-bold' : ''}`}>
                    <td className="p-3 font-mono text-slate-600">{t.wbs_code}</td>
                    <td className="p-3 text-slate-800 flex items-center gap-2">
                       {isSummary ? '📁' : '📄'} {t.name}
                    </td>
                    <td className="p-3 text-center">
  {isSummary ? (
    <span className="text-slate-400">-</span>
  ) : (
    <input 
      type="number" 
      defaultValue={t.volume || 0} 
      onBlur={(e) => handleUpdateVolume(t.id, e.target.value)}
      onFocus={(e) => e.target.select()}
      className="w-20 border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded text-center text-sm py-1 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
    />
  )}
</td>
                    
                    <td className="p-3">
                      {isSummary ? (
                        <div className="text-xs text-slate-400 italic px-3">— Induk (Otomatis) —</div>
                      ) : (
                        <div className="relative">
                          <select
                            value={t.ahsp_template_id || ''}
                            onChange={(e) => handleAssignAhsp(t.id, e.target.value)}
                            disabled={isSaving}
                            className={`w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer ${isSaving ? 'bg-slate-100 opacity-50' : 'bg-white'}`}
                          >
                            <option value="">-- Pilih AHSP Template --</option>
                            {ahspList.map(ahsp => (
                              <option key={ahsp.id} value={ahsp.id}>
                                [{ahsp.kode_ahsp || 'No Code'}] {ahsp.name} ({ahsp.unit})
                              </option>
                            ))}
                          </select>
                          {isSaving && (
                            <div className="absolute right-8 top-1/2 -translate-y-1/2">
                              <Loader2 size={16} className="animate-spin text-blue-600" />
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {assignedAhsp ? (
                           <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold uppercase w-full">Assigned</span>
                        ) : (
                           <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold uppercase w-full">Empty</span>
                        )}
                        
                        {/* VISUAL RESOURCE CHIPS (Auto-Assigned) */}
                        {(() => {
                          const taskResources = assignments.filter(a => a.task_id === t.id);
                          if (taskResources.length === 0) return null;
                          return (
                            <div className="flex flex-wrap justify-center gap-1 mt-1">
                              {taskResources.map((tr, i) => (
                                <span key={i} title={`${tr.project_resources?.name} (${tr.project_resources?.role})`} className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded shadow-sm">
                                  👤 {tr.project_resources?.name}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
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



