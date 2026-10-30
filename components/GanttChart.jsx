'use client';
import { useMemo } from 'react';

export default function GanttChart({ tasks }) {
  if (!tasks || tasks.length === 0) {
    return <div className="p-6 text-center text-gray-500">Belum ada data task untuk ditampilkan di Gantt Chart.</div>;
  }

  const leafTasks = tasks.filter(t => t.summary !== 'Yes' && t.start_date && t.finish_date);
  if (leafTasks.length === 0) return <div className="p-6 text-center text-gray-500">Tidak ada data tanggal valid.</div>;

  // Hitung tanggal paling awal dan paling akhir
  let minDate = new Date(leafTasks[0].start_date);
  let maxDate = new Date(leafTasks[0].finish_date);

  leafTasks.forEach(t => {
    const s = new Date(t.start_date);
    const f = new Date(t.finish_date);
    if (s < minDate) minDate = s;
    if (f > maxDate) maxDate = f;
  });

  // Beri padding 2 hari di awal dan akhir
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 2);
  const totalDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));

  return (
    <div className="overflow-x-auto bg-white rounded-lg border">
      <div className="min-w-[800px]">
        <div className="flex border-b bg-gray-100 text-sm font-semibold p-3 text-gray-700">
           <div className="w-1/3">Task Name</div>
           <div className="w-2/3 flex justify-between px-2">
              <span>{minDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
              <span>Timeline</span>
              <span>{maxDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
           </div>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {leafTasks.map((task, idx) => {
            const tStart = new Date(task.start_date);
            const tFinish = new Date(task.finish_date);
            const offsetDays = Math.max(0, (tStart - minDate) / (1000 * 60 * 60 * 24));
            const durationDays = Math.max(1, (tFinish - tStart) / (1000 * 60 * 60 * 24));
            
            const leftPercent = (offsetDays / totalDays) * 100;
            const widthPercent = (durationDays / totalDays) * 100;

            return (
              <div key={task.id || idx} className="flex border-b hover:bg-gray-50 p-3 items-center">
                <div className="w-1/3 pr-4 truncate text-sm">
                  <span className="text-gray-400 text-xs mr-2">{task.wbs}</span>
                  {task.name}
                </div>
                <div className="w-2/3 relative h-6 bg-gray-100 rounded">
                  <div
                    className="absolute top-0 h-full bg-blue-500 rounded flex items-center justify-end pr-2 text-xs text-white font-medium overflow-hidden shadow-sm"
                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                    title={`${task.start_date} s/d ${task.finish_date} (${task.progress_percent}%)`}
                  >
                     {task.progress_percent > 0 && <span>{task.progress_percent}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
