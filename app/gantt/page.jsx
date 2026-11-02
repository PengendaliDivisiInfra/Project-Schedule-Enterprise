'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import ClientGanttWrapper from '../../components/ClientGanttWrapper';
import LoadingSpinner from '../../components/LoadingSpinner';
import { updateProjectScheduleSecure } from '../../lib/scheduler';
import { updateProjectScheduleSecure } from '../../lib/scheduler';

export default function GanttPage() {
  const [tasks, setTasks] = useState([]);
  const [relations, setRelations] = useState([]);
  const [workingDays, setWorkingDays] = useState([1,2,3,4,5]);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedulerError, setSchedulerError] = useState(null);
  const isUpdatingRef = useRef(false);

  const fetchData = async () => {
    // Jangan set loading(true) jika ini adalah background sync agar UI tidak berkedip
    const { data: projectData } = await supabase.from('projects').select('working_days, exceptions').limit(1).maybeSingle();
    
    let currentWorkingDays = [1,2,3,4,5];
    let currentExceptions = [];
    
    if (projectData) {
      if (projectData.working_days) {
        currentWorkingDays = Array.isArray(projectData.working_days) ? projectData.working_days.map(Number) : [1,2,3,4,5];
        setWorkingDays(currentWorkingDays);
      }
      if (projectData.exceptions) {
        currentExceptions = projectData.exceptions;
        setExceptions(currentExceptions);
      }
    }

    const { data: taskData } = await supabase.from('wbs_tasks').select('*, ahsp_templates(unit)').order('wbs_code');
      
    if (taskData) {
      const uniqueTasks = Array.from(new Map(taskData.map(item => [item.wbs_code, item])).values());
      const formattedTasks = uniqueTasks.map(t => {
        let calculatedDuration = Number(t.duration) || 1;
        if (t.summary !== 'Yes' && t.start_date && t.end_date) {
          let count = 0;
          let cur = new Date(t.start_date);
          const end = new Date(t.end_date);
          while (cur <= end) {
            if (currentWorkingDays.includes(cur.getDay()) && !currentExceptions.some(e => e.exception_date === cur.toISOString().split('T')[0])) count++;
            cur.setDate(cur.getDate() + 1);
          }
          calculatedDuration = Math.max(1, count);
        }
        return { ...t, satuan_hsd: t.ahsp_templates?.unit || 'unit', volume: Number(t.volume) || 0, cost: Number(t.cost) || 0, duration: calculatedDuration };
      });
      setTasks(formattedTasks);
    }

    if (taskData) {
      const rels = [];
      taskData.forEach(t => {
        if (t.predecessors && t.summary !== 'Yes') {
          // Regex untuk menangkap format 1.1, 1.1FS, 1.1SS+2, dll
          const match = t.predecessors.match(/([0-9.]+)(FS|SS|FF|SF)?([+-]\d+)?/);
          if (match) {
            rels.push({ 
              from: match[1], 
              to: t.wbs_code, 
              type: match[2] || 'FS', 
              is_critical: t.is_critical 
            });
          }
        }
      });
      setRelations(rels);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // LOGIKA REAL-TIME SUPABASE
    const channel = supabase.channel('realtime-wbs-gantt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wbs_tasks' }, (payload) => {
        if (isUpdatingRef.current) return;
        
        if (window.ganttTimer) clearTimeout(window.ganttTimer);
        window.ganttTimer = setTimeout(() => {
          console.log('🔄 Sinkronisasi Gantt...');
          fetchData();
        }, 500);
      })
      .subscribe();

        const channel2 = supabase.channel('realtime-gantt-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_progress' }, () => {
        fetchData(); // Update bar chart progress jika ada input harian baru
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(channel2);
    };
  }, []);

  const handleInlineUpdate = async (taskId, field, value) => {
    isUpdatingRef.current = true; // Kunci WebSocket
    
    // 1. Update state lokal secara optimis (hanya field yang diedit)
    let tempTasks = tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t);
    
    // 2. Jalankan Scheduling Engine (Kalkulasi ulang semua tanggal)
    const calculatedTasks = processProjectSchedule(tempTasks, workingDays, exceptions);
    
    // 3. Set state dengan data hasil kalkulasi (Memaksa React Render)
    setTasks([...calculatedTasks]); 

    // 4. Cari semua tugas yang berubah (untuk disimpan ke DB)
    const changedTasks = calculatedTasks.filter(t => {
      const original = tasks.find(o => o.id === t.id);
      return original && (
        original.start_date !== t.start_date || 
        original.end_date !== t.end_date || 
        original.duration !== t.duration || 
        original.predecessors !== t.predecessors
      );
    });

    // 5. Simpan SEMUA perubahan (Successor & Parent) ke Database
    if (changedTasks.length > 0) {
      for (const task of changedTasks) {
        await supabase.from('wbs_tasks').update({
          start_date: task.start_date,
          end_date: task.end_date,
          duration: task.duration,
          predecessors: task.predecessors
        }).eq('id', task.id);
      }
    }

    // 6. VALIDASI FINAL: Tarik ulang data dari DB setelah 1 detik 
    // (Memastikan UI & DB 100% sinkron, menghilangkan stale state)
    setTimeout(async () => {
      const { data } = await supabase.from('wbs_tasks').select('*, ahsp_templates(unit)').order('wbs_code');
      if (data) {
        const uniqueTasks = Array.from(new Map(data.map(item => [item.wbs_code, item])).values());
        const formattedTasks = uniqueTasks.map(t => ({
          ...t, satuan_hsd: t.ahsp_templates?.unit || 'unit', 
          volume: Number(t.volume) || 0, cost: Number(t.cost) || 0, duration: Number(t.duration) || 1
        }));
        setTasks(processProjectSchedule(formattedTasks, workingDays, exceptions));
      }
      isUpdatingRef.current = false; // Buka kunci WebSocket
    }, 1000);
  };

  if (loading) return <LoadingSpinner text="Memuat Gantt Workspace..." />;

  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Interactive Gantt Workspace</h1>
          <p className="text-sm text-slate-500">Kalender: {workingDays.length === 7 ? '7 Hari (Full Day)' : '5 Hari/Minggu'} | Status Date: {new Date().toLocaleDateString('id-ID')}</p>
        </div>
        <ClientGanttWrapper tasks={tasks} relations={relations} workingDays={workingDays} exceptions={exceptions} statusDate={new Date().toISOString().split('T')[0]} onInlineUpdate={handleInlineUpdate} onRefresh={fetchData} />
      </div>
      {/* MODAL ERROR CIRCULAR DEPENDENCY */}
      {schedulerError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Peringatan Sistem</h3>
            <p className="text-sm text-slate-600 mb-6">{schedulerError}</p>
            <button onClick={() => setSchedulerError(null)} className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-bold transition-colors">
              Mengerti
            </button>
          </div>
        </div>
      )}

