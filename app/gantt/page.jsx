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
    setLoading(true);
    
    // 1. Ambil data kalender dari tabel projects
    const { data: projectData } = await supabase.from('projects').select('working_days, exceptions').limit(1).maybeSingle();
    if (projectData) {
      if (projectData.working_days) setWorkingDays(projectData.working_days);
      if (projectData.exceptions) setExceptions(projectData.exceptions);
    }

    // 2. Ambil data tasks
    const { data: taskData, error: taskError } = await supabase
      .from('wbs_tasks')
      .select('*, ahsp_templates(unit)')
      .order('wbs_code');
      
    if (taskData) {
      const formattedTasks = taskData.map(t => ({
        ...t,
        satuan_hsd: t.ahsp_templates?.unit || 'unit',
        volume: Number(t.volume) || 0,
        cost: Number(t.cost) || 0
      }));
      setTasks(formattedTasks);
    }

    // 3. Ambil relasi (Predecessors) untuk SVG Lines
    if (taskData) {
      const rels = [];
      taskData.forEach(t => {
        if (t.predecessors) {
          // Parse string predecessor (misal: "1.1FS+2")
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
  }, []);

  // Fungsi ini dipanggil saat user mengedit Durasi/Tanggal di Gantt
  const handleInlineUpdate = async (taskId, field, value) => {
    // Optimistic UI sudah ditangani di AdvancedGantt.jsx
    // Tugas kita di sini adalah menyimpannya ke database Supabase
    const { error } = await supabase
      .from('wbs_tasks')
      .update({ [field]: value })
      .eq('id', taskId);

    if (error) {
      console.error("Gagal menyimpan ke database:", error);
      alert("Gagal menyimpan: " + error.message);
    } else {
      // Opsional: Fetch ulang data dari DB untuk memastikan data tersimpan
      // Tapi kita tidak melakukannya di sini agar UI tidak berkedip (re-render).
    }
  };

  if (loading) return <LoadingSpinner text="Memuat Gantt Workspace..." />;

  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Interactive Gantt Workspace</h1>
          <p className="text-sm text-slate-500">Kalender: {workingDays.length === 7 ? '7 Hari (Full Day)' : '5 Hari/Minggu'} | Status Date: {new Date().toLocaleDateString('id-ID')}</p>
        </div>

        <ClientGanttWrapper 
          tasks={tasks} 
          relations={relations}
          workingDays={workingDays}
          exceptions={exceptions}
          statusDate={new Date().toISOString().split('T')[0]}
          onInlineUpdate={handleInlineUpdate}
          onRefresh={fetchData}
        />
      </div>
    </div>
  );
}
