'use client';

import { Gantt } from '@blueemllstudio/gantt';
import type { GanttTask, GanttLink } from '@blueemllstudio/gantt';
import { supabase } from '@/lib/supabase';

export default function GanttWorkspace({ tasks = [], links = [], readOnly = false }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center text-slate-500">
        Tidak ada tugas untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full bg-white rounded-lg overflow-hidden border border-slate-200">
      <Gantt
        tasks={tasks}
        links={links}
        // 🟢 PERBAIKAN: rowHeight dipindah ke sini sebagai props langsung
        rowHeight={32}
        onTaskUpdate={async (task) => {
          if (readOnly) return;
          await supabase.from('wbs_tasks').update({
            start_date: task.start.toISOString(),
            end_date: task.end.toISOString(),
            duration: task.duration,
            progress_percent: task.progress,
          }).eq('id', task.id);
        }}
        config={{
          showCriticalPath: true,
          // rowHeight: 32, <--- HAPUS DARI SINI agar TypeScript tidak error
        }}
      />
    </div>
  );
}