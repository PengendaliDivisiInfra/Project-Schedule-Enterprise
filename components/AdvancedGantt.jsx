'use client';
import { useRef, useEffect, useState } from 'react';

const DAY_WIDTH = 40;
const ROW_HEIGHT = 50;

export default function AdvancedGantt({ tasks, relations, workingDays = [1,2,3,4,5], statusDate }) {
  const leftPanelRef = useRef(null);
  const [svgPaths, setSvgPaths] = useState([]);

  // 1. Generate All Calendar Days
  let minDate = new Date();
  let maxDate = new Date();
  tasks.forEach(t => {
    if (t.start_date) { const d = new Date(t.start_date); if (d < minDate) minDate = d; }
    if (t.end_date) { const d = new Date(t.end_date); if (d > maxDate) maxDate = d; }
  });
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 7);
  
  const calendarDays = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
    const isWorking = workingDays.includes(cur.getDay()); 
    calendarDays.push({ date: new Date(cur), isWeekend: !isWorking });
    cur.setDate(cur.getDate() + 1);
  }

  const totalWidth = calendarDays.length * DAY_WIDTH;

  // Helper: Cari posisi X (hanya menghitung hari kerja)
  const getX = (dateStr) => {
    if (!dateStr) return 0;
    let targetDate = new Date(dateStr);
    targetDate.setHours(0,0,0,0);
    let xPos = 0;
    let current = new Date(minDate);
    
    while (current < targetDate) {
      if (workingDays.includes(current.getDay())) {
        xPos += DAY_WIDTH;
      }
      current.setDate(current.getDate() + 1);
    }
    return xPos;
  };

  // 2. Hitung Koordinat SVG Path untuk Garis Panah (Dependency)
  useEffect(() => {
    const paths = [];
    const taskRects = {};

    tasks.forEach((t, idx) => {
      const x = getX(t.start_date);
      const width = t.duration * DAY_WIDTH;
      const y = idx * ROW_HEIGHT;
      
      taskRects[t.wbs_code] = { 
        x, 
        y, 
        width: Math.max(width, t.summary === 'Yes' ? width : 24), 
        height: t.summary === 'Yes' ? 8 : 24 
      };
    });

    relations.forEach(rel => {
      const from = taskRects[rel.from];
      const to = taskRects[rel.to];
      if (!from || !to) return;

      let sourceX, sourceY, targetX, targetY;
      const fromCenterY = from.y + 25;
      const toCenterY = to.y + 25;

      if (rel.type === 'FS') {
        sourceX = from.x + from.width; sourceY = fromCenterY;
        targetX = to.x; targetY = toCenterY;
      } else if (rel.type === 'SS') {
        sourceX = from.x; sourceY = fromCenterY;
        targetX = to.x; targetY = toCenterY;
      } else if (rel.type === 'FF') {
        sourceX = from.x + from.width; sourceY = fromCenterY;
        targetX = to.x + to.width; targetY = toCenterY;
      } else if (rel.type === 'SF') {
        sourceX = from.x; sourceY = fromCenterY;
        targetX = to.x + to.width; targetY = toCenterY;
      }

      const points = [[sourceX, sourceY]];
      const paddingX = 16;

      if (rel.type === 'FS') {
        if (targetX >= sourceX + paddingX) {
          const midX = sourceX + (targetX - sourceX) / 2;
          points.push([midX, sourceY]); points.push([midX, targetY]);
        } else {
          const midY = fromCenterY + (toCenterY - fromCenterY) / 2;
          points.push([sourceX + paddingX, sourceY]); points.push([sourceX + paddingX, midY]);
          points.push([targetX - paddingX, midY]); points.push([targetX - paddingX, targetY]);
        }
      } else {
        const midX = sourceX + (targetX - sourceX) / 2;
        points.push([midX, sourceY]); points.push([midX, targetY]);
      }
      points.push([targetX, targetY]);

      let d = `M ${points[0][0]} ${points[0][1]}`;
      for (let i = 1; i < points.length; i++) d += ` L ${points[i][0]} ${points[i][1]}`;

      paths.push({ d, is_critical: rel.is_critical });
    });

    setSvgPaths(paths);
  }, [tasks, relations]);

  const handleScroll = (e) => {
    if (leftPanelRef.current) {
      leftPanelRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const fmtDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-300 flex flex-col h-[calc(100vh-160px)] overflow-hidden">
      
      {/* HEADER */}
      <div className="flex border-b border-gray-300 bg-gray-100 shrink-0 z-20">
        <div className="w-[500px] border-r border-gray-300 flex text-[10px] font-bold text-gray-700 p-2 bg-gray-200 shrink-0 items-center">
          <span className="w-6 text-center" title="Task Mode">📌</span>
          <span className="w-6 text-center" title="Complete">✓</span>
          <span className="w-12">WBS</span>
          <span className="flex-1">Task Name</span>
          <span className="w-10 text-center">Dur</span>
          <span className="w-12 text-center">Pred</span>
          <span className="w-10 text-center">Float</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex" style={{ width: totalWidth }}>
            {calendarDays.map((cd, i) => (
              <div 
                key={i} 
                className={`text-center text-[10px] border-r border-gray-300 font-semibold py-2 ${cd.isWeekend ? 'bg-gray-300 text-gray-500' : 'bg-gray-200'}`}
                style={{ width: DAY_WIDTH }}
              >
                {cd.date.getDate()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* KOLOM KIRI (Entry Table) */}
        <div ref={leftPanelRef} className="w-[500px] border-r border-gray-300 overflow-y-hidden bg-white shrink-0">
          <div className="min-w-full">
            {tasks.map((t) => (
              <div key={t.id} className="flex text-[11px] items-center px-2 border-b border-gray-100 hover:bg-blue-50 h-[50px]">
                {/* Kolom Task Mode */}
                <span className="w-6 text-center">
                  {t.task_mode === 'Manually Scheduled' ? (
                    <span title="Manually Scheduled">📌</span>
                  ) : (
                    <span title="Auto Scheduled">📅</span>
                  )}
                </span>
                {/* Kolom Complete Checkbox */}
                <span className="w-6 text-center">
                  {t.progress_percent === 100 ? (
                    <span className="text-green-600 font-bold">✓</span>
                  ) : (
                    <span className="text-gray-300">☐</span>
                  )}
                </span>
                <span className="w-12 font-mono text-gray-500">{t.wbs_code}</span>
                <span className={`flex-1 truncate ${t.summary === 'Yes' ? 'font-bold' : ''}`} style={{ paddingLeft: `${(t.indent_level || 0) * 12}px` }}>
                  {t.summary === 'Yes' ? '📁 ' : '📄 '} {t.name}
                </span>
                <span className="w-10 text-center">{t.duration} d</span>
                <span className="w-12 text-center text-gray-500 text-[10px]">{t.predecessors || '-'}</span>
                <span className={`w-10 text-center font-bold ${t.summary === 'Yes' ? 'text-gray-400' : (t.is_critical ? 'text-red-600' : 'text-blue-600')}`}>
                  {t.summary === 'Yes' ? '-' : (t.total_float !== undefined ? t.total_float : '-')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* KOLOM KANAN (Timeline) */}
        <div className="flex-1 overflow-auto relative bg-gray-50/30 select-none" onScroll={handleScroll}>
          <div className="relative" style={{ width: totalWidth, height: tasks.length * ROW_HEIGHT }}>
            
            {/* Layer 1: Grid & Weekend Shading */}
            <div className="absolute inset-0 flex pointer-events-none z-0">
              {calendarDays.map((cd, i) => (
                <div 
                  key={i} 
                  className={`border-r border-gray-200/50 h-full ${cd.isWeekend ? 'bg-gray-300/60' : ''}`}
                  style={{ width: DAY_WIDTH }}
                ></div>
              ))}
            </div>

            {/* Layer 2: Status Date & Current Date Lines */}
            <div 
              className="absolute top-0 bottom-0 border-l-2 border-dashed border-green-500 z-10 pointer-events-none"
              style={{ left: getX(statusDate) }}
              title="Status Date"
            ></div>
            <div 
              className="absolute top-0 bottom-0 border-l border-red-500 z-10 pointer-events-none"
              style={{ left: getX(new Date().toISOString().split('T')[0]) }}
              title="Current Date"
            ></div>

            {/* Layer 3: SVG Dependency Lines */}
            <svg className="absolute inset-0 pointer-events-none z-10" width={totalWidth} height={tasks.length * ROW_HEIGHT}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 6 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
                <marker id="arrow-critical" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 6 5 L 0 8.5 z" fill="#ef4444" />
                </marker>
              </defs>
              {svgPaths.map((p, i) => (
                <path 
                  key={i} 
                  d={p.d} 
                  fill="none" 
                  stroke={p.is_critical ? "#ef4444" : "#94a3b8"} 
                  strokeWidth={p.is_critical ? 2 : 1.5} 
                  markerEnd={p.is_critical ? "url(#arrow-critical)" : "url(#arrow)"} 
                />
              ))}
            </svg>

            {/* Layer 4: Task Bars & Labels */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              {tasks.map((t, idx) => {
                const left = getX(t.start_date);
                const width = t.duration * DAY_WIDTH;
                const top = idx * ROW_HEIGHT + 13;

                const isSummary = t.summary === 'Yes';
                const isCritical = t.is_critical;
                const progress = Number(t.progress_percent) || 0;
                const volume = Number(t.volume || 0);
                const targetHarian = t.duration > 0 ? (volume / t.duration).toFixed(2) : 0;

                // MILESTONE
                if (t.duration === 0) {
                  return (
                    <div key={t.id} className="absolute pointer-events-auto flex items-center" style={{ left: left - 6, top: top - 2 }}>
                      <div className="w-3 h-3 bg-slate-900 rotate-45 shadow-sm z-30"></div>
                      <span className="ml-3 text-[10px] font-bold text-slate-700 whitespace-nowrap bg-white/80 px-1 rounded border border-slate-200">
                        {t.name}
                      </span>
                    </div>
                  );
                }

                // SUMMARY TASK (Jangkar/Bracket MS Project)
                if (isSummary) {
                  return (
                    <div key={t.id} className="absolute pointer-events-auto group" style={{ left, width, top }}>
                      {/* Garis Horizontal */}
                      <div className="absolute top-0 w-full h-[4px] bg-slate-900"></div>
                      {/* Jangkar Kiri */}
                      <div className="absolute top-0 left-0 w-[6px] h-3 bg-slate-900" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 40%)' }}></div>
                      {/* Jangkar Kanan */}
                      <div className="absolute top-0 right-0 w-[6px] h-3 bg-slate-900" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 40%, 0 100%)' }}></div>
                      
                      {/* Label Kanan: Progres */}
                      <span className="absolute -top-3 text-[10px] font-bold text-slate-700 whitespace-nowrap" style={{ left: width + 8 }}>
                        {progress}% Complete
                      </span>
                    </div>
                  );
                }

                // STANDARD SUBTASK
                return (
                  <div key={t.id} className="absolute group" style={{ left, width: Math.max(24, width), top }}>
                    {/* Label Atas: Target per Hari */}
                    <div 
                      className="absolute -top-4 w-full text-center text-[9px] font-bold text-indigo-600 bg-indigo-50/90 px-1 rounded border border-indigo-100 whitespace-nowrap shadow-2xs z-10"
                    >
                      🎯 {targetHarian} {t.satuan_hsd}/hari
                    </div>

                    {/* Batang Utama */}
                    <div className={`h-6 rounded relative shadow-sm border ${isCritical ? 'bg-red-500 border-red-600' : 'bg-blue-500 border-blue-600'}`}>
                      <div style={{ width: `${progress}%` }} className="bg-black/20 h-full text-[10px] text-white flex items-center justify-end pr-1 font-bold overflow-hidden">
                        {progress > 15 && `${progress}%`}
                      </div>
                    </div>

                    {/* Label Kiri: Tanggal Mulai */}
                    <span className="absolute top-[6px] text-[10px] font-semibold text-slate-400 text-right w-10 whitespace-nowrap" style={{ left: -45 }}>
                      {fmtDate(t.start_date)}
                    </span>

                    {/* Label Kanan: Tanggal Selesai, Volume, & Unit */}
                    <div className="absolute top-[5px] flex items-center gap-1 text-[10px] font-medium whitespace-nowrap" style={{ left: Math.max(24, width) + 8 }}>
                      <span className="text-slate-400 font-semibold">{fmtDate(t.end_date)}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        Vol: {volume} {t.satuan_hsd}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
