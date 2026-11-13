'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { updateProjectScheduleSecure, addWorkingDays, countWorkingDays } from '../../lib/scheduler';
import { useProject } from '../../context/ProjectContext';
import { useProjectStore } from '../../store/useProjectStore';
import { useRealtimeWBS } from '../../hooks/useRealtimeWBS';
import { useRole } from '../../lib/hooks/useRole';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { 
  ListTree, Plus, Edit, Trash2, X, Settings, Pin, CheckCircle, XCircle, 
  TrendingDown, TrendingUp, Minus, Eye, EyeOff, Info, Link2, Folder, AlertTriangle
} from 'lucide-react';

const SATUAN_OPTIONS = [
  'Ls', 'M3', 'M2', 'M1', 'Kg', 'Unit', 'Buah', 'Titik', 'Hari', 'Jam', 'OH', 'Org', 'Btg', 'Lbr', 'Zak', 'Roll'
];

export default function TasksPage() {
  const { activeProjectId } = useProject();
  useRealtimeWBS(activeProjectId);
  
  const { can } = useRole(activeProjectId);
  const canEdit = can('EDIT_PROGRESS'); 
  
  const { tasks, setTasks } = useProjectStore();
  
  const [loading, setLoading] = useState(true);
  const [workingDays, setWorkingDays] = useState([1,2,3,4,5]);
  const [exceptions, setExceptions] = useState([]);

  const [showCPM, setShowCPM] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  
  const [formData, setFormData] = useState({});
  const [predList, setPredList] = useState([]);
  const [newPred, setNewPred] = useState({ wbs: '', type: 'FS', lag: 0 });

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    fetchTasksAndCalendar();
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    const channel = supabase.channel('realtime-project-calendar')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, () => {
        fetchTasksAndCalendar();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeProjectId]);

  const parsePreds = (str) => {
    if (!str) return [];
    return str.split(',').map(s => {
        const match = s.trim().match(/^([0-9.]+)(FS|SS|FF|SF)?([+-]\d+)?$/i);
        if (match) return { wbs: match[1], type: match[2] || 'FS', lag: parseInt(match[3] || '0', 10) };
        return null;
    }).filter(Boolean);
  };

  const stringifyPreds = (list) => {
    return list.map(p => `${p.wbs}${p.type}${p.lag > 0 ? '+' + p.lag : p.lag < 0 ? p.lag : ''}`).join(', ');
  };

  const calculateEVM = (data, cwd, cex) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    return data.map(t => {
      const vol = Number(t.volume) || 0;
      const progPct = Number(t.progress_percent) || 0;
      const startDate = t.start_date ? new Date(t.start_date) : null;
      const endDate = t.end_date ? new Date(t.end_date) : null;
      
      let smartTargetPct = 0;
      let sisaHari = t.duration || 1;

      if (t.summary === 'No' && startDate && endDate) {
        if (today >= endDate) {
          smartTargetPct = 100;
          sisaHari = 0;
        } else if (today > startDate) {
          const totalWorkingDays = countWorkingDays(startDate, endDate, cwd, cex) || 1;
          const elapsedWorkingDays = countWorkingDays(startDate, today, cwd, cex);
          
          smartTargetPct = Math.min(100, Math.max(0, (elapsedWorkingDays / totalWorkingDays) * 100));
          sisaHari = Math.max(0, totalWorkingDays - elapsedWorkingDays); 
        } else {
          sisaHari = countWorkingDays(startDate, endDate, cwd, cex);
        }
      }

      const actualVol = vol * (progPct / 100);
      const sisaVol = vol - actualVol;
      const varianPct = progPct - smartTargetPct;
      const butuhTHr = sisaHari > 0 ? (sisaVol / sisaHari) : 0;

      return { ...t, smart_target: Number(smartTargetPct.toFixed(1)), sisa_hari_efektif: sisaHari, actual_vol: actualVol, sisa_vol: sisaVol, varian_pct: Number(varianPct.toFixed(1)), butuh_t_hr: Number(butuhTHr.toFixed(3)) };
    });
  };

  const syncScheduleToDB = async (tasksToSync) => {
    try {
      for (const t of tasksToSync) {
        if (t.summary === 'No') {
          await supabase.from('wbs_tasks').update({
            start_date: t.start_date ? new Date(t.start_date).toISOString().split('T')[0] : null,
            end_date: t.end_date ? new Date(t.end_date).toISOString().split('T')[0] : null,
            early_start: t.early_start ? new Date(t.early_start).toISOString().split('T')[0] : null,
            early_finish: t.early_finish ? new Date(t.early_finish).toISOString().split('T')[0] : null,
            late_start: t.late_start ? new Date(t.late_start).toISOString().split('T')[0] : null,
            late_finish: t.late_finish ? new Date(t.late_finish).toISOString().split('T')[0] : null,
            total_float: t.total_float,
            is_critical: t.is_critical
          }).eq('id', t.id);
        }
      }
    } catch (error) {
      console.error("Gagal sinkronisasi jadwal:", error);
    }
  };

  const fetchTasksAndCalendar = async () => {
    setLoading(true);
    if (!activeProjectId) { setLoading(false); return; }
    
    const { data: projectData } = await supabase.from('projects').select('working_days, exceptions').eq('id', activeProjectId).maybeSingle();
    let cwd = [1,2,3,4,5];
    let cex = [];
    if (projectData) {
      if (projectData.working_days && Array.isArray(projectData.working_days) && projectData.working_days.length > 0) cwd = projectData.working_days.map(Number);
      if (projectData.exceptions) cex = projectData.exceptions;
    }
    setWorkingDays(cwd);
    setExceptions(cex);

    const { data, error } = await supabase.from('wbs_tasks').select('*').eq('project_id', activeProjectId).order('wbs_code', { ascending: true }); 
    if (data) {
      const engineResult = updateProjectScheduleSecure(data, cwd, cex);
      if (engineResult.success) {
        const evmTasks = calculateEVM(engineResult.tasks, cwd, cex);
        const sorted = evmTasks.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));
        setTasks(sorted);
        await syncScheduleToDB(engineResult.tasks); 
      } else {
        setTasks(calculateEVM(data, cwd, cex));
      }
    }
    if (error) console.error(error);
    setLoading(false);
  };

  const handleVolumeUpdate = async (taskId, inputVolume) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const totalVol = Number(task.volume) || 0;
    if (totalVol === 0) return;
    let newVol = Number(inputVolume);
    if (isNaN(newVol) || newVol < 0) newVol = 0;
    if (newVol > totalVol) newVol = totalVol;
    const newPct = (newVol / totalVol) * 100;
    const previousTasks = [...tasks];
    setTasks(prev => {
        const updated = prev.map(t => t.id === taskId ? { ...t, progress_percent: newPct } : t);
        return calculateEVM(updated, workingDays, exceptions);
    });
    showToast(`Progres diupdate: ${newPct.toFixed(1)}%`, 'success');
    const { error } = await supabase.from('wbs_tasks').update({ progress_percent: newPct }).eq('id', taskId);
    if (error) { setTasks(previousTasks); showToast('Gagal update: ' + error.message, 'error'); }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const previousTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== deleteTarget));
    showToast('Task berhasil dihapus', 'success');
    const { error } = await supabase.from('wbs_tasks').delete().eq('id', deleteTarget);
    if (error) { setTasks(previousTasks); showToast('Gagal menghapus task: ' + error.message, 'error'); }
    setDeleteTarget(null);
  };

  const openModal = (task = null) => {
    setCurrentTask(task);
    setFormData(task || {
      task_mode: 'Auto Scheduled', constraint_type: 'ASAP', task_type: 'Fixed Duration', priority: 'Medium', is_milestone: false, duration: 1, progress_percent: 0, satuan_hsd: '', summary: 'No'
    });
    setPredList(parsePreds(task?.predecessors || ''));
    setNewPred({ wbs: '', type: 'FS', lag: 0 });
    setActiveTab('general');
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    let newData = { ...formData, [name]: newValue };

    if (name === 'start_date' && newValue && formData.duration) {
        const dur = Number(formData.duration);
        newData.end_date = addWorkingDays(newValue, dur - 1, workingDays, exceptions);
    } else if (name === 'end_date' && newValue && formData.start_date) {
        const newDur = countWorkingDays(formData.start_date, newValue, workingDays, exceptions);
        newData.duration = newDur;
    } else if (name === 'duration' && newValue && formData.start_date) {
        const dur = Number(newValue);
        newData.end_date = addWorkingDays(formData.start_date, dur - 1, workingDays, exceptions);
    }

    if (name === 'is_milestone' && newValue === true) {
        newData.duration = 0;
        if (formData.start_date) newData.end_date = formData.start_date;
    }

    setFormData(newData);
  };

  const addPredecessor = () => {
    if (!newPred.wbs) return showToast('Pilih task pendahulu!', 'error');
    if (newPred.wbs === currentTask?.wbs_code) return showToast('Task tidak bisa menjadi pendahulu dirinya sendiri!', 'error');
    if (predList.some(p => p.wbs === newPred.wbs)) {
        return showToast('Predecessor ini sudah ditambahkan!', 'error');
    }
    setPredList([...predList, newPred]);
    setNewPred({ wbs: '', type: 'FS', lag: 0 });
  };

  const removePredecessor = (index) => {
    setPredList(predList.filter((_, i) => i !== index));
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    
    let finalData = { ...formData };
    if (finalData.start_date && finalData.end_date) {
        finalData.duration = countWorkingDays(finalData.start_date, finalData.end_date, workingDays, exceptions);
    }
    
    let finalPredList = [...predList];
    if (newPred.wbs) {
        finalPredList.push(newPred);
    }
    finalData.predecessors = stringifyPreds(finalPredList);

    const saveData = {
      name: finalData.name, 
      volume: Number(finalData.volume) || 0, 
      duration: Number(finalData.duration) || 1,
      start_date: finalData.start_date || null, 
      end_date: finalData.end_date || null,
      progress_percent: Number(Number(finalData.progress_percent).toFixed(2)) || 0, 
      task_mode: finalData.task_mode,
      constraint_type: finalData.constraint_type, 
      constraint_date: finalData.constraint_date || null,
      task_type: finalData.task_type, 
      priority: finalData.priority, 
      is_milestone: finalData.is_milestone,
      predecessors: finalData.predecessors, 
      tags: finalData.tags, 
      assignee: finalData.assignee, 
      wbs_dictionary: finalData.wbs_dictionary,
      satuan_hsd: finalData.summary === 'Yes' ? null : (finalData.satuan_hsd || null)
    };

    setIsModalOpen(false);

    if (currentTask?.id) {
      const previousTasks = [...tasks];
      let updatedTasks = tasks.map(t => t.id === currentTask.id ? { ...t, ...saveData } : t);
      
      const cpmResult = updateProjectScheduleSecure(updatedTasks, workingDays, exceptions);
      if (cpmResult.success) updatedTasks = cpmResult.tasks;
      
      const evmTasks = calculateEVM(updatedTasks, workingDays, exceptions);
      const sorted = evmTasks.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));
      
      setTasks(sorted);
      showToast('Task diperbarui', 'success');

      const { error } = await supabase.from('wbs_tasks').update(saveData).eq('id', currentTask.id);
      if (!error) await syncScheduleToDB(updatedTasks); 
      if (error) { setTasks(previousTasks); showToast('Gagal: ' + error.message, 'error'); }

    } else {
      const newTaskData = { ...saveData, project_id: activeProjectId, wbs_code: '99.' + Math.floor(Math.random() * 100), summary: 'No' };
      const { data: insertedData, error } = await supabase.from('wbs_tasks').insert([newTaskData]).select().maybeSingle();

      if (error) {
        showToast('Gagal: ' + error.message, 'error');
      } else if (insertedData) {
        let updatedTasks = [...tasks, insertedData];
        const cpmResult = updateProjectScheduleSecure(updatedTasks, workingDays, exceptions);
        if (cpmResult.success) updatedTasks = cpmResult.tasks;
        
        const evmTasks = calculateEVM(updatedTasks, workingDays, exceptions);
        const sorted = evmTasks.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));
        
        setTasks(sorted);
        showToast('Task ditambahkan', 'success');
      }
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 p-6 md:p-8">
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[10000] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-top-4 fade-in ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {/* FIX: Padding container disamakan dengan tabel di bawahnya */}
      <div className="max-w-[1920px] mx-auto px-0 space-y-6 animate-in fade-in duration-300">
        
        {/* HEADER PREMIUM */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <ListTree className="text-indigo-600 w-7 h-7" /> Manajemen Tugas (CPM & EVM)
            </h1>
            <p className="text-sm text-slate-500 mt-1">Ketik Volume Realisasi untuk mengupdate Progres secara otomatis.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={() => setShowCPM(!showCPM)} className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors shadow-sm ${showCPM ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              {showCPM ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showCPM ? 'Sembunyikan CPM' : 'Tampilkan CPM'}
            </button>
            {canEdit && (
              <button onClick={() => openModal()} className="flex-1 md:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                <Plus className="w-4 h-4" /> Tambah Tugas
              </button>
            )}
          </div>
        </div>

        {/* TABEL PREMIUM */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto max-h-[75vh] custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-300">
                  <th className="p-3 font-bold text-center w-12 sticky top-0 left-0 bg-slate-50 z-30">Mode</th>
                  <th className="p-3 font-bold w-16 sticky top-0 left-12 bg-slate-50 z-30 border-r border-slate-200">WBS</th>
                  <th className="p-3 font-bold min-w-[250px] sticky top-0 left-28 bg-slate-50 z-30 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Tugas</th>
                  
                  <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Satuan</th>
                  <th className="p-3 font-bold text-center bg-slate-100 sticky top-0 z-20">Vol Total</th>
                  
                  {showCPM && (
                    <>
                      <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Dur</th>
                      <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Mulai</th>
                      <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Selesai</th>
                      <th className="p-3 font-bold text-center bg-blue-50 text-blue-700 sticky top-0 z-20">ES</th>
                      <th className="p-3 font-bold text-center bg-blue-50 text-blue-700 sticky top-0 z-20">EF</th>
                      <th className="p-3 font-bold text-center bg-amber-50 text-amber-700 sticky top-0 z-20">LS</th>
                      <th className="p-3 font-bold text-center bg-amber-50 text-amber-700 sticky top-0 z-20">LF</th>
                      <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Slack</th>
                      <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Crit</th>
                    </>
                  )}
                  {!showCPM && (
                    <>
                      <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Dur</th>
                      <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Mulai</th>
                      <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Selesai</th>
                    </>
                  )}

                  <th className="p-3 font-bold text-center bg-yellow-50 text-yellow-800 border-l-2 border-yellow-200 sticky top-0 z-20">Vol. Realisasi</th>
                  <th className="p-3 font-bold text-center bg-orange-50 text-orange-700 sticky top-0 z-20">Sisa Vol</th>
                  <th className="p-3 font-bold text-center bg-indigo-50 text-indigo-700 sticky top-0 z-20">Target (%)</th>
                  <th className="p-3 font-bold text-center bg-blue-50 text-blue-800 border-r-2 border-blue-200 sticky top-0 z-20">Aktual (%)</th>
                  <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Varian</th>
                  <th className="p-3 font-bold text-center bg-emerald-50 text-emerald-700 sticky top-0 z-20">T/Hari</th>
                  <th className="p-3 font-bold text-center sticky top-0 bg-slate-50 z-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                   <tr>
                     <td colSpan={showCPM ? 21 : 15} className="p-0">
                       <SkeletonLoader rows={10} cols={showCPM ? 10 : 7} />
                     </td>
                   </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={showCPM ? 21 : 15} className="p-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <ListTree className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-bold text-lg text-slate-600">Belum ada Tugas / WBS.</p>
                        <p className="text-sm mt-1">Klik "Tambah Tugas" untuk mulai membuat jadwal proyek.</p>
                      </div>
                    </td>
                  </tr>
                ) : tasks.map((t) => {
                  const isSummary = t.summary === 'Yes' || t.summary !== 'No';
                  const varian = t.varian_pct || 0;
                  return (
                    <tr key={t.id} className={`group hover:bg-indigo-50/30 transition-colors ${t.is_critical && !isSummary ? 'bg-red-50/20' : ''}`}>
                      
                      <td className={`p-3 text-center sticky left-0 z-10 transition-colors ${t.is_critical && !isSummary ? 'bg-red-50 group-hover:bg-indigo-50' : 'bg-white group-hover:bg-indigo-50'}`}>
                        {isSummary ? (
                          <Folder className="w-4 h-4 text-slate-400 mx-auto" />
                        ) : t.task_mode === 'Manually Scheduled' ? (
                          <Pin className="w-3.5 h-3.5 text-amber-600 mx-auto" />
                        ) : (
                          <Settings className="w-3.5 h-3.5 text-blue-500 mx-auto" />
                        )}
                      </td>
                      
                      <td className={`p-3 font-mono font-bold sticky left-12 z-10 border-r border-slate-100 transition-colors ${t.is_critical && !isSummary ? 'bg-red-50 text-red-700 group-hover:bg-indigo-50' : 'bg-white text-slate-500 group-hover:bg-indigo-50'}`}>{t.wbs_code}</td>
                      <td className={`p-3 sticky left-28 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors ${isSummary ? 'font-bold text-slate-900 bg-slate-50 group-hover:bg-indigo-100' : 'font-medium text-slate-700 bg-white group-hover:bg-indigo-50'}`}>
                        <span style={{ paddingLeft: `${(t.indent_level || 0) * 12}px` }} className="truncate block max-w-[300px]">{t.name}</span>
                      </td>
                      
                      <td className="p-3 text-center font-mono text-slate-500">{isSummary ? '-' : (t.satuan_hsd || '-')}</td>
                      <td className="p-3 text-center font-mono tabular-nums bg-slate-50/50 font-semibold">{isSummary ? '-' : `${t.volume}`}</td>
                      
                      {showCPM && (
                        <>
                          <td className="p-3 text-center font-mono tabular-nums">{t.duration} d</td>
                          <td className="p-3 text-center font-mono">{formatDateDisplay(t.start_date)}</td>
                          <td className="p-3 text-center font-mono">{formatDateDisplay(t.end_date)}</td>
                          <td className="p-3 text-center font-mono text-blue-600 bg-blue-50/20">{formatDateDisplay(t.early_start)}</td>
                          <td className="p-3 text-center font-mono text-blue-600 bg-blue-50/20">{formatDateDisplay(t.early_finish)}</td>
                          <td className="p-3 text-center font-mono text-amber-600 bg-amber-50/20">{formatDateDisplay(t.late_start)}</td>
                          <td className="p-3 text-center font-mono text-amber-600 bg-amber-50/20">{formatDateDisplay(t.late_finish)}</td>
                          <td className={`p-3 text-center font-mono tabular-nums font-bold ${t.slack < 0 ? 'text-red-600' : t.slack === 0 ? 'text-orange-600' : 'text-slate-600'}`}>{isSummary ? '-' : t.slack}</td>
                          <td className="p-3 text-center">
                            {isSummary ? '-' : t.is_critical ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md font-bold text-[9px] border border-red-200">YES</span> : <span className="text-slate-400 text-[9px] font-medium">No</span>}
                          </td>
                        </>
                      )}
                      {!showCPM && (
                        <>
                          <td className="p-3 text-center font-mono tabular-nums">{t.duration} d</td>
                          <td className="p-3 text-center font-mono">{formatDateDisplay(t.start_date)}</td>
                          <td className="p-3 text-center font-mono">{formatDateDisplay(t.end_date)}</td>
                        </>
                      )}

                      <td className="p-1 text-center bg-yellow-50/30 border-l-2 border-yellow-100">
                        {isSummary || t.volume === 0 ? '-' : (
                          <input 
                            type="number" 
                            defaultValue={t.actual_vol.toFixed(2)}
                            onBlur={(e) => handleVolumeUpdate(t.id, e.target.value)}
                            disabled={!canEdit}
                            className={`w-20 px-2 py-1.5 text-center font-mono tabular-nums font-bold border rounded-lg transition-all outline-none ${!canEdit ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white border-slate-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 shadow-sm'}`}
                            step="0.01"
                          />
                        )}
                      </td>

                      <td className="p-3 text-center font-mono tabular-nums font-bold text-orange-600 bg-orange-50/20">
                        {isSummary || t.volume === 0 ? '-' : (t.sisa_vol || 0).toFixed(2)}
                      </td>

                      <td className="p-3 text-center font-mono tabular-nums font-bold text-indigo-600 bg-indigo-50/20">{isSummary ? '-' : `${(t.smart_target || 0).toFixed(1)}%`}</td>
                      <td className="p-3 text-center font-mono tabular-nums font-bold text-blue-600 bg-blue-50/20 border-r-2 border-blue-100">
                          {isSummary ? '-' : (
                          <div className="flex flex-col items-center gap-1.5 w-full">
                              <span>{Number(t.progress_percent || 0).toFixed(1)}%</span>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 relative overflow-hidden">
                                  <div className={`h-1.5 rounded-full ${varian < 0 ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: `${t.progress_percent || 0}%` }}></div>
                                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: `${t.smart_target || 0}%` }}></div>
                              </div>
                          </div>
                          )}
                      </td>
                      <td className={`p-3 text-center font-mono tabular-nums font-bold ${varian < 0 ? 'text-red-600' : varian > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {isSummary ? '-' : (
                          <div className="flex items-center justify-center gap-1">
                              {varian > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : varian < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                              {varian > 0 ? '+' : ''}{varian.toFixed(1)}%
                          </div>
                          )}
                      </td>
                      <td className={`p-3 text-center font-mono tabular-nums font-bold bg-emerald-50/20 ${varian < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {isSummary || t.volume === 0 ? '-' : (t.butuh_t_hr || 0).toFixed(3)}
                      </td>

                      <td className="p-3 text-center">
                        {canEdit ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => openModal(t)} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors" title="Edit Task"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteTarget(t.id)} className="text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors" title="Hapus Task"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic font-semibold bg-slate-100 px-2 py-1 rounded-md">Read-Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL TASK INFORMATION (Premium Design) */}
      {isModalOpen && (
         <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
         <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200/60">
           
           <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ListTree className="w-5 h-5 text-indigo-600" /> Informasi Tugas</h2>
             <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-full transition-colors border border-slate-200"><X className="w-5 h-5"/></button>
           </div>
           
           <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2 gap-2 overflow-x-auto custom-scrollbar">
              <button type="button" onClick={() => setActiveTab('general')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'general' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Info Umum</button>
              <button type="button" onClick={() => setActiveTab('metadata')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'metadata' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Metadata</button>
              <button type="button" onClick={() => setActiveTab('predecessors')} className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'predecessors' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Pendahulu (Predecessors)</button>
              <button type="button" onClick={() => setActiveTab('help')} className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === 'help' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Info className="w-4 h-4"/> Panduan</button>
           </div>
           
           <form onSubmit={handleSaveModal} className="flex flex-col flex-1 overflow-hidden">
             <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                {activeTab === 'general' && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Tugas</label>
                      <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Rencana Mulai</label>
                        <input type="date" name="start_date" value={formData.start_date?.split('T')[0] || ''} onChange={handleChange} disabled={formData.task_mode === 'Auto Scheduled'} className={`w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none transition-all font-medium ${formData.task_mode === 'Auto Scheduled' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Rencana Selesai</label>
                        <input type="date" name="end_date" value={formData.end_date?.split('T')[0] || ''} onChange={handleChange} disabled={formData.task_mode === 'Auto Scheduled'} className={`w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none transition-all font-medium ${formData.task_mode === 'Auto Scheduled' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Durasi (Hari)</label>
                        <input type="number" name="duration" value={formData.duration || 1} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all tabular-nums font-bold text-slate-800" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Progres (%)</label>
                        <input type="number" name="progress_percent" value={Number(formData.progress_percent || 0).toFixed(2)} onChange={handleChange} min="0" max="100" step="0.01" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all tabular-nums font-bold text-slate-800" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Satuan</label>
                        <select name="satuan_hsd" value={formData.satuan_hsd || ''} onChange={handleChange} disabled={formData.summary === 'Yes'} className={`w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none transition-all font-semibold ${formData.summary === 'Yes' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}>
                          <option value="">-- Pilih --</option>
                          {SATUAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-5 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mt-4">
                      <div>
                        <label className="block text-xs font-bold text-indigo-800 mb-1.5 uppercase tracking-wider">Mode Jadwal</label>
                        <select name="task_mode" value={formData.task_mode} onChange={handleChange} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm bg-white font-bold text-indigo-900 focus:ring-4 focus:ring-indigo-500/10 outline-none cursor-pointer">
                          <option value="Auto Scheduled">Auto Scheduled (Mengikuti CPM)</option>
                          <option value="Manually Scheduled">Manually Scheduled (Kunci Manual)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-indigo-800 mb-1.5 uppercase tracking-wider">Constraint (Batasan)</label>
                        <select name="constraint_type" value={formData.constraint_type || 'ASAP'} onChange={handleChange} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm bg-white font-bold text-indigo-900 focus:ring-4 focus:ring-indigo-500/10 outline-none cursor-pointer">
                          <option value="ASAP">ASAP (Secepat Mungkin)</option>
                          <option value="SNET">SNET (Mulai Tidak Lebih Awal)</option>
                          <option value="MSO">MSO (Harus Mulai Pada)</option>
                          <option value="FNET">FNET (Selesai Tidak Lebih Awal)</option>
                          <option value="FNLT">FNLT (Selesai Tidak Lebih Lambat)</option>
                          <option value="MFO">MFO (Harus Selesai Pada)</option>
                        </select>
                      </div>
                      {formData.constraint_type !== 'ASAP' && (
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-indigo-800 mb-1.5 uppercase tracking-wider">Tanggal Constraint</label>
                          <input type="date" name="constraint_date" value={formData.constraint_date?.split('T')[0] || ''} onChange={handleChange} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'metadata' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Prioritas</label>
                        <select name="priority" value={formData.priority || 'Medium'} onChange={handleChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none bg-white font-semibold">
                          <option value="Low">Rendah</option>
                          <option value="Medium">Sedang</option>
                          <option value="High">Tinggi</option>
                          <option value="Critical">Kritis</option>
                        </select>
                      </div>
                      <div className="flex items-center mt-6">
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200 w-full hover:bg-slate-100 transition-colors shadow-sm">
                          <input type="checkbox" name="is_milestone" checked={formData.is_milestone || false} onChange={handleChange} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                          <span className="text-sm font-bold text-slate-700">Tandai sebagai Milestone</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tags (Pisahkan dengan koma)</label>
                      <input type="text" name="tags" value={formData.tags || ''} onChange={handleChange} placeholder="Contoh: Struktur, Kritis, Klien" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Penanggung Jawab (Assignee)</label>
                      <input type="text" name="assignee" value={formData.assignee || ''} onChange={handleChange} placeholder="Nama pengawas / mandor" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">WBS Dictionary (Deskripsi)</label>
                      <textarea name="wbs_dictionary" rows="3" value={formData.wbs_dictionary || ''} onChange={handleChange} placeholder="Deskripsi detail lingkup pekerjaan..." className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none"></textarea>
                    </div>
                  </div>
                )}

                {activeTab === 'predecessors' && (
                  <div className="space-y-5">
                    <p className="text-sm text-slate-500">Pilih tugas pendahulu. Tanggal mulai tugas ini akan otomatis mengikuti tugas yang dipilih.</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-end shadow-sm">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tugas Pendahulu</label>
                            <select value={newPred.wbs} onChange={(e) => setNewPred({...newPred, wbs: e.target.value})} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none">
                                <option value="">-- Pilih Tugas --</option>
                                {tasks.filter(t => t.wbs_code !== currentTask?.wbs_code && t.summary === 'No').map(t => (<option key={t.id} value={t.wbs_code}>{t.wbs_code} - {t.name}</option>))}
                            </select>
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tipe Hubungan</label>
                            <select value={newPred.type} onChange={(e) => setNewPred({...newPred, type: e.target.value})} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none">
                                <option value="FS">FS (Finish-to-Start)</option><option value="SS">SS (Start-to-Start)</option><option value="FF">FF (Finish-to-Finish)</option><option value="SF">SF (Start-to-Finish)</option>
                            </select>
                        </div>
                        <div className="w-full md:w-28">
                            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Lag (Hari)</label>
                            <input type="number" value={newPred.lag} onChange={(e) => setNewPred({...newPred, lag: Number(e.target.value)})} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none" />
                        </div>
                        <button type="button" onClick={addPredecessor} className="bg-slate-800 text-white p-2.5 rounded-lg hover:bg-slate-900 transition-colors shadow-sm"><Plus className="w-5 h-5" /></button>
                    </div>
                    <div className="mt-3 bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                        <div className="text-[11px] text-blue-800 leading-relaxed font-medium">
                            {newPred.type === 'FS' && <span><b>Finish-to-Start (FS):</b> Pekerjaan ini baru bisa dimulai setelah pekerjaan pendahulu selesai 100%.</span>}
                            {newPred.type === 'SS' && <span><b>Start-to-Start (SS):</b> Pekerjaan ini bisa dimulai secara bersamaan dengan mulainya pekerjaan pendahulu.</span>}
                            {newPred.type === 'FF' && <span><b>Finish-to-Finish (FF):</b> Pekerjaan ini baru bisa selesai setelah pekerjaan pendahulu selesai.</span>}
                            {newPred.type === 'SF' && <span><b>Start-to-Finish (SF):</b> Pekerjaan ini baru bisa selesai setelah pekerjaan pendahulu dimulai.</span>}
                        </div>
                    </div>
                    <div className="space-y-3 mt-4">
                        {predList.length === 0 ? (<p className="text-sm text-slate-400 italic text-center p-4 border border-dashed rounded-xl">Belum ada predecessor dipilih.</p>) : (
                            predList.map((p, idx) => {
                                const taskRef = tasks.find(t => t.wbs_code === p.wbs);
                                return (
                                    <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm hover:border-indigo-300 transition-colors">
                                        <div className="flex items-center gap-3">
                                          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Link2 className="w-4 h-4" /></div>
                                          <div>
                                            <span className="font-bold text-sm text-slate-800">{p.wbs} - {taskRef?.name || 'Unknown'}</span>
                                            <div className="text-[10px] text-slate-500 font-medium">Tipe: {p.type} | Lag: {p.lag} hari</div>
                                          </div>
                                        </div>
                                        <button type="button" onClick={() => removePredecessor(idx)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                  </div>
                )}

                {activeTab === 'help' && (
                  <div className="space-y-5 text-sm text-slate-700">
                    <h3 className="font-bold text-indigo-700 text-base flex items-center gap-2"><Info className="w-5 h-5"/> Fungsi Tipe Tugas</h3>
                    <ul className="list-disc pl-5 space-y-1.5 mb-4 font-medium">
                      <li><strong>Fixed Duration:</strong> Durasi terkunci. Mengubah Start/Finish akan menggeser blok waktu.</li>
                      <li><strong>Fixed Units:</strong> Jumlah pekerja terkunci. Mengubah durasi akan mengubah total jam kerja.</li>
                      <li><strong>Fixed Work:</strong> Total jam kerja terkunci. Memperpendek durasi akan menambah jumlah pekerja.</li>
                    </ul>
                    <h3 className="font-bold text-indigo-700 text-base flex items-center gap-2"><Info className="w-5 h-5"/> Fungsi Constraint</h3>
                    <p className="font-medium">Constraint = batasan waktu yang memaksa kapan tugas harus mulai/selesai.</p>
                    <ul className="list-disc pl-5 space-y-1.5 font-medium">
                      <li><strong>ASAP</strong> - Ikuti jadwal predecessor murni (Default).</li>
                      <li><strong>SNET</strong> - Tugas baru boleh mulai SETELAH tanggal X.</li>
                      <li><strong>MSO</strong> - Tugas HARUS mulai TEPAT tanggal X.</li>
                      <li><strong>MFO</strong> - Tugas HARUS selesai TEPAT tanggal X.</li>
                    </ul>
                  </div>
                )}
             </div>

             <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 mt-auto">
               <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
               <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
                 <CheckCircle className="w-4 h-4" /> Simpan Tugas
               </button>
             </div>
           </form>
         </div>
       </div>
      )}

      <ConfirmModal 
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Hapus Tugas"
        message="Apakah Anda yakin ingin menghapus tugas ini? Tindakan ini tidak dapat dibatalkan dan akan mempengaruhi jadwal CPM."
      />
    </div>
  );
}