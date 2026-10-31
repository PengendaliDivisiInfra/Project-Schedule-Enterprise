'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdvancedGantt from '../../components/AdvancedGantt';
import LoadingSpinner from '../../components/LoadingSpinner';
import { calculateCPM } from '../../lib/cpmEngine';

export default function GanttPage() {
  const [tasks, setTasks] = useState([]);
  const [relations, setRelations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingDays, setWorkingDays] = useState([1,2,3,4,5]);
  const [exceptions, setExceptions] = useState([]);
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let { data: projects } = await supabase.from('projects').select('id').limit(1);
      let projectId = projects?.[0]?.id;
      if (!projectId) {
        let { data: t } = await supabase.from('wbs_tasks').select('project_id').limit(1);
        projectId = t?.[0]?.project_id;
      }
      
      let activeWorkingDays = [1,2,3,4,5];
      let activeExceptions = [];

      if (projectId) {
        let { data: cal } = await supabase.from('project_calendars').select('*').eq('project_id', projectId).limit(1).maybeSingle();
        if (cal && cal.id) {
          activeWorkingDays = cal.working_days || [1,2,3,4,5];
          let { data: exc } = await supabase.from('calendar_exceptions').select('*').eq('calendar_id', cal.id);
          activeExceptions = exc || [];
        }
        setWorkingDays(activeWorkingDays);
        setExceptions(activeExceptions);

        // ⚠️ PERBAIKAN: Ambil data langsung dari wbs_tasks, JOIN dengan ahsp_templates untuk unit
        const { data, error } = await supabase
          .from('wbs_tasks')
          .select(`
            *,
            ahsp_templates ( unit )
          `)
          .eq('project_id', projectId)
          .order('wbs_code', { ascending: true });
        
        if (data && data.length > 0) {
          const mappedData = data.map(t => ({
            ...t,
            satuan_hsd: t.ahsp_templates?.unit || 'unit',
            resource_names: t.resource_names || '',
            smart_target: Number(t.smart_target) || 0,
            volume: Number(t.volume) || 0, // Pastikan volume terambil sebagai angka
            // Kalkulasi target per hari fallback (jika view DB belum siap)
            target_per_hari: 0,
            sisa_hari_efektif: 0
          }));

          const projectStart = data[0].start_date || new Date().toISOString().split('T')[0];
          const result = calculateCPM(mappedData, projectStart, activeWorkingDays, activeExceptions);
          
          if (!result.error) {
            const finalTasks = result.tasks.map(t => ({
              ...t,
              satuan_hsd: mappedData.find(m => m.id === t.id)?.satuan_hsd || 'unit',
              resource_names: mappedData.find(m => m.id === t.id)?.resource_names || '',
              smart_target: mappedData.find(m => m.id === t.id)?.smart_target || 0,
              volume: mappedData.find(m => m.id === t.id)?.volume || 0
            }));
            setTasks(finalTasks);
            setRelations(result.relations);
          } else {
            setTasks(mappedData);
          }
        } else {
          setTasks([]);
        }
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInlineUpdate = async (taskId, field, value) => {
    try {
      // Pastikan format tanggal benar sebelum dikirim
      let formattedValue = value;
      if (field === 'start_date' || field === 'end_date') {
        formattedValue = value; // Input type="date" sudah mengembalikan format YYYY-MM-DD
      }

      const { error } = await supabase.from('wbs_tasks').update({ [field]: formattedValue }).eq('id', taskId);
      if (error) throw error;
      
      // Fetch ulang data untuk sinkronisasi CPM Engine dan Trigger DB
      fetchData(); 
    } catch (err) {
      alert("Gagal update: " + err.message);
    }
  };

  return (
    <div className="p-2 bg-gray-50 h-screen flex flex-col">
      <div className="mb-4 flex justify-between items-center px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Interactive Gantt Workspace</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kalender: <b>{workingDays.length} Hari/Minggu</b> | Status Date: <b>{new Date(statusDate).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</b>
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">
        {loading ? <LoadingSpinner text="Membangun Gantt Chart..." /> : (
          <AdvancedGantt 
            tasks={tasks} 
            relations={relations} 
            workingDays={workingDays} 
            statusDate={statusDate} 
            exceptions={exceptions} 
            onInlineUpdate={handleInlineUpdate}
          />
        )}
      </div>
    </div>
  );
}
