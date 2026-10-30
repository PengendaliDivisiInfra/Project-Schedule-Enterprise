'use client';
import { useMemo } from 'react';

export default function AdvancedGantt({ tasks }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-10 text-center text-gray-500 bg-white rounded-lg border border-dashed">
        <p className="text-lg font-medium mb-2">Belum ada data Task.</p>
        <p className="text-sm">Silakan tambahkan task di menu Tasks (WBS) untuk melihat Gantt Chart.</p>
      </div>
    );
  }

  // 1. Kalkulasi Rentang Tanggal (Timeline Bounds)
  let minDate = new Date();
  let maxDate = new Date();
  
  tasks.forEach(t => {
    const s = new Date(t.start_date || new Date());
    const f = new Date(t.end_date || new Date());
    if (s < minDate) minDate = s;
    if (f > maxDate) maxDate = f;
  });

  minDate.setDate(minDate.getDate() - 2); // Padding kiri
  maxDate.setDate(maxDate.getDate() + 3); // Padding kanan

  const totalDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));

  // 2. Generate Header Tanggal (Harian)
  const dateHeaders = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    dateHeaders.push({
      date: new Date(cur),
      isWeekend: cur.getDay() === 0 || cur.getDay() === 6
    });
    cur.setDate(cur.getDate() + 1);
  }

  // 3. Render Baris Task
  const renderTaskBar = (task, index) => {
    const tStart = new Date(task.start_date);
    const tFinish = new Date(task.end_date);
    
    // Hitung posisi berdasarkan persentase
    const offsetDays = Math.max(0, (tStart - minDate) / (1000 * 60 * 60 * 24));
    const durationDays = Math.max(1, (tFinish - tStart) / (1000 * 60 * 60 * 24));
    
    const leftPercent = (offsetDays / totalDays) * 100;
    const widthPercent = (durationDays / totalDays) * 100;
    
    const isSummary = task.summary === 'Yes';
    const isCritical = task.is_critical;
    const progress = Number(task.progress_percent) || 0;

    // MS Project Style Colors
    let barColor = 'bg-blue-500'; // Standard Task
    if (isSummary) barColor = 'bg-slate-800'; // Summary Task
    else if (isCritical) barColor = 'bg-red-500'; // Critical Path

    return (
      <div key={task.id || index} className="flex border-b border-gray-200 hover:bg-blue-50 transition-colors h-10">
        {/* Kolom Kiri: Tabel Data */}
        <div className="w-[450px] border-r border-gray-300 flex text-xs items-center px-2 bg-white shrink-0 z-10">
          <span className="w-12 font-mono text-gray-500">{task.wbs_code}</span>
          <span className={`flex-1 truncate ${isSummary ? 'font-bold' : ''}`} style={{ paddingLeft: `${(task.indent_level || 0) * 12}px` }}>
            {isSummary ? '📁 ' : '📄 '} {task.name}
          </span>
          <span className="w-12 text-center">{task.duration} d</span>
          <span className="w-16 text-center text-gray-500 text-[10px]">{task.predecessors || '-'}</span>
          <span className={`w-16 text-center font-bold ${isSummary ? 'text-gray-400' : (isCritical ? 'text-red-600' : 'text-blue-600')}`}>
            {isSummary ? '-' : (task.total_float !== undefined ? task.total_float : '-')}
          </span>
        </div>

        {/* Kolom Kanan: Timeline Bar */}
        <div className="flex-1 relative flex items-center min-w-[600px] bg-gray-50/30">
          {/* Grid Background */}
          <div className="absolute inset-0 flex">
            {dateHeaders.map((dh, i) => (
              <div 
                key={i} 
                className={`flex-1 border-r border-gray-200 ${dh.isWeekend ? 'bg-gray-100/50' : ''}`}
                style={{ minWidth: '20px' }}
              ></div>
            ))}
          </div>

          {/* Task Bar */}
          <div
            className={`absolute h-5 rounded-sm shadow-sm flex items-center overflow-hidden ${barColor}`}
            style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, minWidth: isSummary ? '8px' : '20px' }}
            title={`${task.name} (${progress}%)`}
          >
            {/* Progress Fill (Hanya untuk leaf task) */}
            {!isSummary && (
              <div className="h-full bg-black/20 absolute top-0 left-0" style={{ width: `${progress}%` }}></div>
            )}
            <span className="text-[9px] text-white font-bold px-1 z-10 w-full truncate">
              {!isSummary && progress > 0 ? `${progress}%` : ''}
            </span>
          </div>

          {/* Milestone Diamond (Jika durasi 0) */}
          {task.duration === 0 && (
            <div 
              className="absolute w-3 h-3 bg-yellow-400 rotate-45 transform -translate-x-1/2 shadow-sm z-10"
              style={{ left: `${leftPercent}%` }}
              title="Milestone"
            ></div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      {/* Header Tabel */}
      <div className="flex bg-gray-100 border-b border-gray-300 shrink-0 z-20">
        <div className="w-[450px] flex text-xs font-bold text-gray-700 p-2 border-r border-gray-300 bg-gray-200">
          <span className="w-12">WBS</span>
          <span className="flex-1">Task Name</span>
          <span className="w-12 text-center">Dur</span>
          <span className="w-16 text-center">Pred</span>
          <span className="w-16 text-center">Float</span>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {dateHeaders.map((dh, i) => (
            <div 
              key={i} 
              className={`flex-1 text-center text-[10px] border-r border-gray-300 font-semibold ${dh.isWeekend ? 'bg-gray-300 text-gray-600' : 'bg-gray-200'}`}
              style={{ minWidth: '20px' }}
            >
              {dh.date.getDate()}
            </div>
          ))}
        </div>
      </div>

      {/* Body Gantt (Scrollable Sync) */}
      <div className="flex-1 overflow-y-auto overflow-x-auto relative">
        <div className="min-w-max">
          {tasks.map((task, index) => renderTaskBar(task, index))}
        </div>
      </div>
    </div>
  );
}
