'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gantt } from '@bluemillstudio/gantt';
import type { GanttTask, GanttLink } from '@bluemillstudio/gantt';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function GanttWorkspace({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [links, setLinks] = useState<GanttLink[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    // 1. Fetch dari Supabase
    const { data: rawTasks } = await supabase.from('wbs_tasks').select('*').eq('project_id', projectId).order('wbs_code');
    const { data: deps } = await supabase.from('task_dependencies').select('*').eq('project_id', projectId);

    if (!rawTasks) { setLoading(false); return; }

    // 2. Panggil engine CPM
    const res = await fetch('/api/engine/cpm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
    const engine = await res.json();
    const engineMap = new Map<string, any>(engine.tasks?.map((t: any) => [t.id, t]));

    // 3. Mapping ke GanttTask
    const ganttTasks: GanttTask[] = rawTasks.map((t) => {
      const eng = engineMap.get(t.id);
      const isCritical = eng ? eng.slack <= 0 : false;

      return {
        id: t.id,
        text: t.name,
        start: new Date(t.start_date),
        end: new Date(t.end_date),
        duration: t.duration,
        progress: t.progress_percent,
        parentId: t.parent_id || null,
        type: t.is_milestone ? 'milestone' : 'task',
        open: true,
        $x: 0, $y: 0, $w: 0, $h: 0, $level: 0,
        // Menerapkan class CSS merah jika critical
        customClass: isCritical ? 'critical-task' : '',
      };
    });

    // 4. Mapping ke GanttLink
    const ganttLinks: GanttLink[] = (deps || []).map((d) => ({
      id: d.id,
      source: d.source_task_id,
      target: d.target_task_id,
      type: d.dependency_type === 'FS' ? 'e2s' : d.dependency_type === 'SS' ? 's2s' : d.dependency_type === 'FF' ? 'e2e' : 's2e',
    }));

    setTasks(ganttTasks);
    setLinks(ganttLinks);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="h-full flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2"/> Memuat Workspace...</div>;

  return (
    <div className="h-full w-full bg-white rounded-lg overflow-hidden">
      <Gantt
        tasks={tasks}
        links={links}
        onTaskUpdate={async (task) => {
          await supabase.from('wbs_tasks').update({
            start_date: task.start.toISOString(),
            end_date: task.end.toISOString(),
            duration: task.duration,
            progress_percent: task.progress,
          }).eq('id', task.id);
          await loadData(); // Recalculate CPM setelah perubahan
        }}
        config={{
          criticalPath: true,
          autoSchedule: true,
          calendar: { workDays: [1, 2, 3, 4, 5], holidays: [] },
        }}
      />
    </div>
  );
}