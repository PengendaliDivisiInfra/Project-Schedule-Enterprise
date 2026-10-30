'use client';

export default function GanttChart({ tasks }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-10 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed">
        <p className="text-lg font-medium mb-2">Belum ada data Task.</p>
        <p className="text-sm">Silakan buka halaman "Tasks (WBS)" dan klik tombol "Generate Data Dummy".</p>
      </div>
    );
  }

  // Filter: summary !== 'Yes', dan harus punya start_date & end_date
  const leafTasks = tasks.filter(t => t.summary !== 'Yes' && t.start_date && t.end_date);
  if (leafTasks.length === 0) return <div className="p-6 text-center text-gray-500">Tidak ada data tanggal valid.</div>;

  let minDate = new Date(leafTasks[0].start_date);
  let maxDate = new Date(leafTasks[0].end_date);

  leafTasks.forEach(t => {
    const s = new Date(t.start_date);
    const f = new Date(t.end_date);
    if (s < minDate) minDate = s;
    if (f > maxDate) maxDate = f;
  });

  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 3);
  const totalDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));

  const dateHeaders = [];
  let currentDate = new Date(minDate);
  while (currentDate <= maxDate) {
    dateHeaders.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg border shadow-sm">
      <div className="min-w-[900px]">
        <div className="flex border-b bg-gray-100 font-semibold text-sm text-gray-700">
          <div className="w-[35%] p-3 border-r flex gap-4">
            <span className="w-12">WBS</span>
            <span className="flex-1">Task Name</span>
            <span className="w-24 text-center">Start</span>
            <span className="w-24 text-center">Finish</span>
          </div>
          <div className="w-[65%] flex relative">
            {dateHeaders.map((date, idx) => (
              <div key={idx} className="flex-1 border-r p-3 text-center text-xs border-gray-200" style={{ minWidth: '80px' }}>
                {date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
              </div>
            ))}
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {leafTasks.map((task, idx) => {
            const tStart = new Date(task.start_date);
            const tFinish = new Date(task.end_date);
            
            const offsetDays = Math.max(0, (tStart - minDate) / (1000 * 60 * 60 * 24));
            const durationDays = Math.max(1, (tFinish - tStart) / (1000 * 60 * 60 * 24));
            
            const leftPercent = (offsetDays / totalDays) * 100;
            const widthPercent = (durationDays / totalDays) * 100;
            const progress = Number(task.progress_percent) || 0;

            let barColor = "bg-blue-500";
            if (progress === 100) barColor = "bg-green-500";
            else if (progress > 0) barColor = "bg-blue-600";

            return (
              <div key={task.id || idx} className="flex border-b hover:bg-blue-50 transition-colors">
                <div className="w-[35%] p-3 border-r flex gap-4 text-sm items-center">
                  <span className="w-12 text-gray-500 font-mono text-xs">{task.wbs}</span>
                  <span className="flex-1 font-medium truncate" title={task.name}>{task.name}</span>
                  <span className="w-24 text-center text-xs text-gray-500">{tStart.toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}</span>
                  <span className="w-24 text-center text-xs text-gray-500">{tFinish.toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}</span>
                </div>

                <div className="w-[65%] relative flex items-center bg-gray-50/50">
                  <div className="absolute inset-0 flex">
                     {dateHeaders.map((_, i) => <div key={i} className="flex-1 border-r border-gray-100"></div>)}
                  </div>
                  
                  <div
                    className={`absolute h-6 rounded-md shadow-sm flex items-center overflow-hidden ${barColor}`}
                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                    title={`${task.name} (${progress}%)`}
                  >
                    <div className="h-full bg-black/20 absolute top-0 left-0" style={{ width: `${progress}%` }}></div>
                    <span className="text-[10px] text-white font-bold px-2 z-10 w-full truncate">
                      {progress > 0 ? `${progress}%` : ''}
                    </span>
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
