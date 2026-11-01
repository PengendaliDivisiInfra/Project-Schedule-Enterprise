'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import ClientGanttWrapper from '../../components/ClientGanttWrapper';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function GanttPage() {
  const [tasks, setTasks] = useState([]);
  const [relations, setRelations] = useState([]);
  const [workingDays, setWorkingDays] = useState([1,2,3,4,5]);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);

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
          const match = t.predecessors.match(/([0-9.]+)(FS|SS|FF|SF)?([+-]\d+)?/);
          if (match) rels.push({ from: match[1], to: t.wbs_code, type: match[2] || 'FS', is_critical: t.is_critical });
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
        console.log('🔄 Data berubah dari layar lain, sinkronisasi Gantt...', payload);
        fetchData(); // Ambil data terbaru secara otomatis
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
    await supabase.from('wbs_tasks').update({ [field]: value }).eq('id', taskId);
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
    </div>
  );
}

