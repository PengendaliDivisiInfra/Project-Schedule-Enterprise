'use client';
import { useRef, useEffect, useState } from 'react';

const DAY_WIDTH = 30;
const ROW_HEIGHT = 40;

export default function AdvancedGantt({ tasks, relations }) {
  const leftPanelRef = useRef(null);
  const [svgPaths, setSvgPaths] = useState([]);

  // 1. Generate Working Days Array
  let minDate = new Date();
  let maxDate = new Date();
  tasks.forEach(t => {
    if (t.start_date) { const d = new Date(t.start_date); if (d < minDate) minDate = d; }
    if (t.end_date) { const d = new Date(t.end_date); if (d > maxDate) maxDate = d; }
  });
  minDate.setDate(minDate.getDate() - 2); // Padding
  maxDate.setDate(maxDate.getDate() + 5); // Padding
  
  const workingDays = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) { // 0=Minggu, 6=Sabtu
      workingDays.push(new Date(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }

  const totalWidth = workingDays.length * DAY_WIDTH;

  // Helper: Cari posisi X berdasarkan tanggal
  const getX = (dateStr) => {
    if (!dateStr) return 0;
    const idx = workingDays.findIndex(d => d.toISOString().split('T')[0] === dateStr);
    return idx !== -1 ? idx * DAY_WIDTH : 0;
  };

  // 2. Hitung Koordinat & SVG Path
  useEffect(() => {
    const paths = [];
    const taskRects = {};

    tasks.forEach((t, idx) => {
      const x = getX(t.start_date);
      const width = t.duration * DAY_WIDTH;
      const y = idx * ROW_HEIGHT;
      taskRects[t.wbs_code] = { x, y, width, height: 20 };
    });

    relations.forEach(rel => {
      const from = taskRects[rel.from];
      const to = taskRects[rel.to];
      if (!from || !to) return;

      let sourceX, sourceY, targetX, targetY;
      const fromCenterY = from.y + (from.height / 2);
      const toCenterY = to.y + (to.height / 2);

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

  // 3. Sinkronisasi Scroll
  const handleScroll = (e) => {
    if (leftPanelRef.current) {
      leftPanelRef.current.scrollTop = e.target.scrollTop;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-300 flex flex-col h-[calc(100vh-160px)] overflow-hidden">
      
      {/* Header Tabel & Kalender */}
      <div className="flex border-b border-gray-300 bg-gray-100 shrink-0 z-20">
        <div className="w-[450px] border-r border-gray-300 flex text-xs font-bold text-gray-700 p-2 bg-gray-200 shrink-0">
          <span className="w-12">WBS</span>
          <span className="flex-1">Task Name</span>
          <span className="w-12 text-center">Dur</span>
          <span className="w-16 text-center">Pred</span>
          <span className="w-16 text-center">Float</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex" style={{ width: totalWidth }}>
            {workingDays.map((wd, i) => (
              <div 
                key={i} 
                className="text-center text-[10px] border-r border-gray-300 font-semibold py-2 bg-gray-200"
                style={{ width: DAY_WIDTH }}
              >
                {wd.getDate()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body Gantt (Dual Panel) */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Panel Kiri: Tabel Data */}
        <div ref={leftPanelRef} className="w-[450px] border-r border-gray-300 overflow-y-hidden bg-white shrink-0">
          <div className="min-w-full">
            {tasks.map((t) => (
              <div key={t.id} className="flex text-xs items-center px-2 border-b border-gray-100 hover:bg-blue-50 h-[40px]">
                <span className="w-12 font-mono text-gray-500">{t.wbs_code}</span>
                <span className={`flex-1 truncate ${t.summary === 'Yes' ? 'font-bold' : ''}`} style={{ paddingLeft: `${(t.indent_level || 0) * 12}px` }}>
                  {t.summary === 'Yes' ? '📁 ' : '📄 '} {t.name}
                </span>
                <span className="w-12 text-center">{t.duration} d</span>
                <span className="w-16 text-center text-gray-500 text-[10px]">{t.predecessors || '-'}</span>
                <span className={`w-16 text-center font-bold ${t.summary === 'Yes' ? 'text-gray-400' : (t.is_critical ? 'text-red-600' : 'text-blue-600')}`}>
                  {t.summary === 'Yes' ? '-' : (t.total_float !== undefined ? t.total_float : '-')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel Kanan: Timeline & SVG Links */}
        <div 
          className="flex-1 overflow-auto relative bg-gray-50/30 select-none"
          onScroll={handleScroll}
        >
          <div className="relative" style={{ width: totalWidth, height: tasks.length * ROW_HEIGHT }}>
            
            {/* Layer 1: Grid Background */}
            <div className="absolute inset-0 flex pointer-events-none">
              {workingDays.map((wd, i) => (
                <div 
                  key={i} 
                  className="border-r border-gray-200/50 h-full"
                  style={{ width: DAY_WIDTH }}
                ></div>
              ))}
            </div>

            {/* Layer 2: SVG Dependency Lines */}
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

            {/* Layer 3: Task Bars */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              {tasks.map((t, idx) => {
                const left = getX(t.start_date);
                const width = t.duration * DAY_WIDTH;
                const top = idx * ROW_HEIGHT + 10;

                const isSummary = t.summary === 'Yes';
                const isCritical = t.is_critical;
                const progress = Number(t.progress_percent) || 0;

                let barColor = 'bg-blue-500';
                if (isSummary) barColor = 'bg-slate-800';
                else if (isCritical) barColor = 'bg-red-500';

                if (width === 0) {
                  return (
                    <div
                      key={t.id}
                      className="absolute w-3 h-3 bg-yellow-400 rotate-45 transform -translate-x-1/2 shadow-sm pointer-events-auto cursor-pointer z-30"
                      style={{ left: left, top: top - 2 }}
                      title={`Milestone: ${t.name}`}
                    ></div>
                  );
                }

                return (
                  <div
                    key={t.id}
                    className={`absolute h-5 rounded-sm shadow-sm flex items-center overflow-hidden ${barColor} pointer-events-auto cursor-pointer`}
                    style={{ left, width: Math.max(20, width) }}
                    title={`${t.name} (${progress}%)`}
                  >
                    {!isSummary && (
                      <div className="h-full bg-black/20 absolute top-0 left-0" style={{ width: `${progress}%` }}></div>
                    )}
                    <span className="text-[9px] text-white font-bold px-1 z-10 w-full truncate">
                      {!isSummary && progress > 0 ? `${progress}%` : ''}
                    </span>
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
