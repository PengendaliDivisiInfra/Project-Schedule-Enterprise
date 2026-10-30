'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdvancedGantt from '../../components/AdvancedGantt';
import LoadingSpinner from '../../components/LoadingSpinner';
import { calculateCPM } from '../../lib/cpmEngine';

export default function GanttPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        let { data: projects } = await supabase.from('projects').select('id').limit(1);
        let projectId = projects?.[0]?.id;
        if (!projectId) {
          let { data: t } = await supabase.from('wbs_tasks').select('project_id').limit(1);
          projectId = t?.[0]?.project_id;
        }
        
        if (projectId) {
          const { data } = await supabase.from('wbs_tasks').select('*').eq('project_id', projectId).order('wbs_code', { ascending: true });
          if (data && data.length > 0) {
            const projectStart = data[0].start_date || new Date().toISOString().split('T')[0];
            const result = calculateCPM(data, projectStart);
            
            if (!result.error) {
              setTasks(result.tasks);
            } else {
              setTasks(data);
            }
          }
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    loadData();
  }, []);

  return (
    <div className="p-2 bg-gray-50 h-screen flex flex-col">
      <div className="mb-4 flex justify-between items-center px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Interactive Gantt Workspace</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualisasi MS Project Style. Warna <span className="text-red-600 font-bold">Merah</span> menandakan Jalur Kritis.
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">
        {loading ? <LoadingSpinner text="Membangun Gantt Chart..." /> : (
          <AdvancedGantt tasks={tasks} />
        )}
      </div>
    </div>
  );
}
