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

  useEffect(() => {
    async function loadData() {
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

          // ⚠️ NESTED QUERY: Ambil unit dari ahsp_templates
          const { data } = await supabase.from('wbs_tasks').select(`
            *, 
            ahsp_templates ( unit )
          `).eq('project_id', projectId).order('wbs_code', { ascending: true });
          
          if (data && data.length > 0) {
            const mappedData = data.map(t => ({
              ...t,
              satuan_hsd: t.ahsp_templates?.unit || 'unit'
            }));

            const projectStart = data[0].start_date || new Date().toISOString().split('T')[0];
            const result = calculateCPM(mappedData, projectStart, activeWorkingDays, activeExceptions);
            
            if (!result.error) {
              const finalTasks = result.tasks.map(t => ({
                ...t,
                satuan_hsd: mappedData.find(m => m.id === t.id)?.satuan_hsd || 'unit'
              }));
              
              setTasks(finalTasks);
              setRelations(result.relations);
            } else {
              console.error("CPM Error:", result.error);
              setTasks(mappedData);
            }
          }
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setLoading(false); 
      }
    }
    loadData();
  }, []);

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
          <AdvancedGantt tasks={tasks} relations={relations} workingDays={workingDays} statusDate={statusDate} />
        )}
      </div>
    </div>
  );
}
