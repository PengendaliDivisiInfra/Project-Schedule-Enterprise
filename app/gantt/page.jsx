'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import ClientGanttWrapper from '../../components/ClientGanttWrapper';
import LoadingSpinner from '../../components/LoadingSpinner';
import { updateProjectScheduleSecure } from '../../lib/scheduler';
import { AlertTriangle } from 'lucide-react';

export default function GanttPage() {
  const [tasks, setTasks] = useState([]);
  const [relations, setRelations] = useState([]);
  const [workingDays, setWorkingDays] = useState([1,2,3,4,5]);
  const [exceptions, setExceptions] = useState([]);
  const [taskAssignments, setTaskAssignments] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedulerError, setSchedulerError] = useState(null);
  const isUpdatingRef = useRef(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    
    const { data: projectData } = await supabase.from('projects').select('working_days, exceptions').limit(1).maybeSingle();
    let currentWorkingDays = [1,2,3,4,5];
    let currentExceptions = [];
    if (projectData) {
      if (projectData.working_days) currentWorkingDays = Array.isArray(projectData.working_days) ? projectData.working_days.map(Number) : [1,2,3,4,5];
      if (projectData.exceptions) currentExceptions = projectData.exceptions;
      setWorkingDays(currentWorkingDays);
      setExceptions(currentExceptions);
    }

    const { data: taskData } = await supabase.from('wbs_tasks').select('*, ahsp_templates(unit)').order('wbs_code');
    const { data: assignmentsData } = await supabase.from('task_assignments').select('*');
    const { data: resourcesData } = await supabase.from('project_resources').select('*');
    if (assignmentsData) setTaskAssignments(assignmentsData);
    if (resourcesData) setResources(resourcesData);
      
    if (taskData) {
      const uniqueTasks = Array.from(new Map(taskData.map(item => [item.wbs_code, item])).values());
      let formattedTasks = uniqueTasks.map(t => {
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

      // PISAHKAN MANUAL DAN AUTO
      const autoTasks = formattedTasks.filter(t => t.task_mode !== 'Manually Scheduled');
      const manualTasks = formattedTasks.filter(t => t.task_mode === 'Manually Scheduled');
      
      let finalTasks = formattedTasks;
      if (autoTasks.length > 0) {
        const result = updateProjectScheduleSecure(autoTasks, currentWorkingDays, currentExceptions);
        if (result.success) {
           finalTasks = [...result.tasks, ...manualTasks].sort((a,b) => a.wbs_code.localeCompare(b.wbs_code));
        }
      }
      setTasks(finalTasks);
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

    if (!silent) setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('realtime-wbs-gantt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wbs_tasks' }, () => {
        if (isUpdatingRef.current) return;
        if (window.ganttTimer) clearTimeout(window.ganttTimer);
        window.ganttTimer = setTimeout(() => { fetchData(true); }, 500);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleInlineUpdate = async (taskId, field, value) => {
    isUpdatingRef.current = true; 
    
    let updateData = {};
    let tempTasks = tasks.map(t => {
        if (t.id === taskId) {
            if (field === 'BULK_UPDATE') {
                updateData = value;
                return { ...t, ...value };
            } else {
                updateData = { [field]: value };
                // Paksa manual jika user mengedit tanggal
                if (field === 'start_date' || field === 'end_date' || field === 'duration') {
                    updateData.task_mode = 'Manually Scheduled';
                    return { ...t, [field]: value, task_mode: 'Manually Scheduled' };
                }
                return { ...t, [field]: value };
            }
        }
        return t;
    });
    
    const currentTask = tempTasks.find(t => t.id === taskId);

    // BYPASS CPM ENGINE JIKA MANUAL
    if (currentTask?.task_mode === 'Manually Scheduled' || field === 'BULK_UPDATE') {
      setTasks([...tempTasks]);
      await supabase.from('wbs_tasks').update(updateData).eq('id', taskId);
      setTimeout(() => { isUpdatingRef.current = false; }, 1000);
      return;
    }

    const result = updateProjectScheduleSecure(tempTasks, workingDays, exceptions);
    if (!result.success) {
      setSchedulerError(result.errorMessage);
      isUpdatingRef.current = false;
      return; 
    }
    
    const calculatedTasks = result.tasks;
    setTasks([...calculatedTasks]); 

    const changedTasks = calculatedTasks.filter(t => {
      const original = tasks.find(o => o.id === t.id);
      return original && (original.start_date !== t.start_date || original.end_date !== t.end_date || original.duration !== t.duration);
    });

    if (changedTasks.length > 0) {
      for (const task of changedTasks) {
        await supabase.from('wbs_tasks').update({
          start_date: task.start_date, end_date: task.end_date, duration: task.duration, predecessors: task.predecessors
        }).eq('id', task.id);
      }
    }
    setTimeout(() => { isUpdatingRef.current = false; }, 1000);
  };

  if (loading) return <LoadingSpinner text="Memuat Gantt Workspace..." />;

  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Interactive Gantt Workspace</h1>
        </div>
        <ClientGanttWrapper 
          tasks={tasks} relations={relations} taskAssignments={taskAssignments} resources={resources}
          workingDays={workingDays} exceptions={exceptions} statusDate={new Date().toISOString().split('T')[0]}
          onInlineUpdate={handleInlineUpdate} onRefresh={fetchData}
        />
      </div>
      {schedulerError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 text-center max-w-md shadow-2xl">
            <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Peringatan Sistem</h3>
            <p className="text-sm text-slate-600 mb-6">{schedulerError}</p>
            <button onClick={() => setSchedulerError(null)} className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg">Mengerti</button>
          </div>
        </div>
      )}
    </div>
  );
}