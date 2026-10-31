'use client';
import { useRef, useEffect, useState } from 'react';

const DAY_WIDTH = 36;
const ROW_HEIGHT = 38;

export default function AdvancedGantt({ tasks, relations, workingDays = [1,2,3,4,5], statusDate, exceptions = [], onInlineUpdate }) {
  const leftPanelRef = useRef(null);
  const [svgPaths, setSvgPaths] = useState([]);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  const displayTasks = showCriticalOnly 
    ? tasks.filter(t => t.is_critical || t.summary === 'Yes') 
    : tasks;

  // 1. Generate Calendar Days
  let minDate = new Date();
  let maxDate = new Date();
  displayTasks.forEach(t => {
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

  // 2. Grouping Header by Month & Year
  const monthGroups = [];
  let currentMonth = -1;
  let currentYear = -1;
  let monthStartIndex = 0;

  calendarDays.forEach((cd, idx) => {
    const m = cd.date.getMonth();
    const y = cd.date.getFullYear();
    if (m !== currentMonth || y !== currentYear) {
      if (currentMonth !== -1) {
        monthGroups.push({
          name: new Date(currentYear, currentMonth).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
          span: idx - monthStartIndex
        });
      }
      currentMonth = m;
      currentYear = y;
      monthStartIndex = idx;
    }
  });
  if (currentMonth !== -1) {
    monthGroups.push({
      name: new Date(currentYear, currentMonth).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
      span: calendarDays.length - monthStartIndex
    });
  }

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

  // 3. Hitung SVG Path (Garis Panah)
  useEffect(() => {
    const paths = [];
    const taskRects = {};

    displayTasks.forEach((t, idx) => {
      const x = getX(t.start_date);
      const width = t.duration * DAY_WIDTH;
      const y = idx * ROW_HEIGHT;
      taskRects[t.wbs_code] = { x, y, width: Math.max(width, t.summary === 'Yes' ? width : 16), height: t.summary === 'Yes' ? 6 : 16 };
    });

    relations.forEach(rel => {
      const from = taskRects[rel.from];
      const to = taskRects[rel.to];
      if (!from || !to) return;
      let sourceX, sourceY, targetX, targetY;
      const fromCenterY = from.y + (ROW_HEIGHT / 2);
      const toCenterY = to.y + (ROW_HEIGHT / 2);

      if (rel.type === 'FS') { sourceX = from.x + from.width; sourceY = fromCenterY; targetX = to.x; targetY = toCenterY; } 
      else if (rel.type === 'SS') { sourceX = from.x; sourceY = fromCenterY; targetX = to.x; targetY = toCenterY; } 
      else if (rel.type === 'FF') { sourceX = from.x + from.width; sourceY = fromCenterY; targetX = to.x + to.width; targetY = toCenterY; } 
      else if (rel.type === 'SF') { sourceX = from.x; sourceY = fromCenterY; targetX = to.x + to.width; targetY = toCenterY; }

      const points = [[sourceX, sourceY]];
      const paddingX = 12;

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
  }, [displayTasks, relations]);

  const handleScroll = (e) => {
    if (leftPanelRef.current) {
      leftPanelRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const fmtDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-';
  
  // Pastikan format tanggal untuk input type="date" selalu YYYY-MM-DD
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) { return ''; }
  };

  const calculateDailyTarget = (task) => {
    if (task.target_per_hari !== undefined && task.target_per_hari !== null && task.target_per_hari > 0) return Number(task.target_per_hari).toFixed(2);
    const totalTarget = Number(task.smart_target) || 0;
    const progress = Number(task.progress_percent) || 0;
    if (progress >= 100) return 0;
    if (totalTarget === 0) return 0;
    const today = new Date(); const finish = new Date(task.end_date);
    let remainingDays = 0; let cur = new Date(today);
    while (cur <= finish) {
      if (workingDays.includes(cur.getDay()) && !exceptions.some(e => e.exception_date === cur.toISOString().split('T')[0])) remainingDays++;
      cur.setDate(cur.getDate() + 1);
    }
    if (remainingDays <= 0) return totalTarget.toFixed(2);
    return (totalTarget / remainingDays).toFixed(2);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-400 flex flex-col h-[calc(100vh-120px)] overflow-hidden font-sans">
      
      {/* HEADER (2 Baris: Bulan & Tanggal) */}
      <div className="flex border-b border-gray-400 bg-[#f3f3f3] shrink-0 z-20">
        <div className="w-[1080px] border-r border-gray-400 flex flex-col shrink-0">
          {/* Header Atas (Tabel Kiri) */}
          <div className="flex justify-between items-center px-1 py-1 border-b border-gray-300 bg-[#e6e6e6]">
            <div className="flex text-[11px] font-semibold text-gray-700 items-center">
              <span className="w-6 text-center" title="Task Mode">📌</span>
              <span className="w-6 text-center" title="Complete">✓</span>
              <span className="w-10 text-center" title="ID">ID</span>
              <span className="w-48 pl-1 border-l border-gray-300">Task Name</span>
              <span className="w-20 text-center border-l border-gray-300 bg-slate-200 text-slate-800">Volume</span>
              <span className="w-10 text-center border-l border-gray-300">Dur</span>
              <span className="w-[85px] text-center border-l border-gray-300">Start</span>
              <span className="w-[85px] text-center border-l border-gray-300">Finish</span>
              <span className="w-12 text-center border-l border-gray-300">Pred</span>
              <span className="w-16 text-center border-l border-gray-300">Resource</span>
              <span className="w-10 text-center border-l border-gray-300">%</span>
              <span className="w-12 text-center border-l border-gray-300">Target</span>
              <span className="w-10 text-center border-l border-gray-300">Sisa</span>
              <span className="w-12 text-center border-l border-gray-300">T/hr</span>
            </div>
            <button 
              onClick={() => setShowCriticalOnly(!showCriticalOnly)}
              className={`text-[10px] px-2 py-0.5 rounded border ml-2 transition-colors ${showCriticalOnly ? 'bg-red-600 text-white border-red-700' : 'bg-white text-gray-600 border-gray-400 hover:bg-gray-50'}`}
            >
              {showCriticalOnly ? 'Critical' : 'All'}
            </button>
          </div>
          {/* Header Bawah (Tabel Kiri) - Spacer */}
          <div className="h-[24px] bg-[#f3f3f3]"></div>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Header Atas (Timeline) - Bulan */}
          <div className="flex border-b border-gray-300 bg-[#e6e6e6]" style={{ width: totalWidth }}>
            {monthGroups.map((mg, i) => (
              <div 
                key={i} 
                className="text-center text-[10px] font-bold text-gray-700 border-r border-gray-300 py-0.5"
                style={{ width: mg.span * DAY_WIDTH }}
              >
                {mg.name}
              </div>
            ))}
          </div>
          {/* Header Bawah (Timeline) - Tanggal */}
          <div className="flex bg-[#f3f3f3]" style={{ width: totalWidth }}>
            {calendarDays.map((cd, i) => (
              <div 
                key={i} 
                className={`text-center text-[10px] border-r border-gray-300 font-medium py-1 ${cd.isWeekend ? 'bg-[#d9d9d9] text-gray-600' : 'text-gray-800'}`}
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
        <div ref={leftPanelRef} className="w-[1080px] border-r border-gray-400 overflow-y-hidden bg-white shrink-0">
          <div className="min-w-full">
            {displayTasks.map((t, idx) => {
              const dailyTarget = calculateDailyTarget(t);
              const isSummary = t.summary === 'Yes';
              return (
                <div key={t.id} className={`flex text-[11px] items-center px-1 border-b border-gray-200 h-[38px] group ${isSummary ? 'bg-[#f9f9f9] font-semibold' : 'hover:bg-blue-50'}`}>
                  
                  {/* Mode & Checkbox */}
                  <span className="w-6 text-center">
                    {t.task_mode === 'Manually Scheduled' ? <span title="Manually Scheduled">📌</span> : <span className="text-blue-500" title="Auto Scheduled">📅</span>}
                  </span>
                  <span className="w-6 text-center">
                    {t.progress_percent === 100 ? <span className="text-green-600 font-bold">✓</span> : <span className="text-gray-300">☐</span>}
                  </span>
                  
                  {/* WBS Code */}
                  <span className="w-10 font-mono text-gray-600 text-center">{t.wbs_code}</span>
                  
                  {/* Task Name (Inline Edit) */}
                  <div className="w-48 pl-1 border-r border-gray-100" style={{ paddingLeft: `${(t.indent_level || 0) * 12 + 4}px` }}>
                    <input 
                      type="text" 
                      defaultValue={t.name} 
                      onBlur={(e) => onInlineUpdate(t.id, 'name', e.target.value)}
                      className={`w-full border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-1 text-[11px] bg-transparent ${isSummary ? 'font-bold' : ''}`}
                    />
                  </div>

                  {/* VOLUME (Inline Edit) */}
                  <div className="w-20 px-1 border-r border-gray-100 bg-slate-50">
                    {!isSummary && (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          defaultValue={t.volume || 0} 
                          onBlur={(e) => onInlineUpdate(t.id, 'volume', Number(e.target.value))}
                          className="w-10 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded text-center bg-transparent text-[11px] font-bold"
                        />
                        <span className="text-[9px] text-gray-500 font-medium truncate">{t.satuan_hsd}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Duration (Inline Edit) */}
                  <div className="w-10 text-center border-l border-gray-100">
                    {isSummary ? (
                      <span>{t.duration}d</span>
                    ) : (
                      <input 
                        type="number" 
                        defaultValue={t.duration} 
                        onBlur={(e) => onInlineUpdate(t.id, 'duration', Number(e.target.value))}
                        className="w-8 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded text-center bg-transparent text-[11px]"
                      />
                    )}
                  </div>
                  
                  {/* Start (Inline Edit) - Lebar Diperbesar */}
                  <div className="w-[85px] text-center border-l border-gray-100">
                    {isSummary ? (
                      <span className="text-gray-600">{fmtDate(t.start_date)}</span>
                    ) : (
                      <input 
                        type="date" 
                        defaultValue={formatDateForInput(t.start_date)} 
                        onBlur={(e) => onInlineUpdate(t.id, 'start_date', e.target.value)}
                        className="w-[75px] border border-transparent hover:border-gray-300 focus:border-blue-500 rounded text-center bg-transparent text-[10px]"
                      />
                    )}
                  </div>

                  {/* Finish (Inline Edit) - Lebar Diperbesar */}
                  <div className="w-[85px] text-center border-l border-gray-100">
                    {isSummary ? (
                      <span className="text-gray-600">{fmtDate(t.end_date)}</span>
                    ) : (
                      <input 
                        type="date" 
                        defaultValue={formatDateForInput(t.end_date)} 
                        onBlur={(e) => onInlineUpdate(t.id, 'end_date', e.target.value)}
                        className="w-[75px] border border-transparent hover:border-gray-300 focus:border-blue-500 rounded text-center bg-transparent text-[10px]"
                      />
                    )}
                  </div>
                  
                  {/* Predecessors */}
                  <span className="w-12 text-center text-gray-500 border-l border-gray-100 truncate" title={t.predecessors}>{t.predecessors || '-'}</span>
                  
                  {/* Resource (Inline Edit) */}
                  <div className="w-16 px-1 border-l border-gray-100">
                    {!isSummary && (
                      <input 
                        type="text" 
                        defaultValue={t.resource_names || ''} 
                        placeholder="..."
                        onBlur={(e) => onInlineUpdate(t.id, 'resource_names', e.target.value)}
                        className="w-full border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-1 text-[10px] bg-transparent truncate placeholder:text-gray-300"
                        title={t.resource_names}
                      />
                    )}
                  </div>
                  
                  {/* % Complete */}
                  <span className="w-10 text-center font-bold text-gray-700 border-l border-gray-100">{t.progress_percent}%</span>
                  
                  {/* SMART Target */}
                  <span className="w-12 text-center font-bold text-indigo-700 border-l border-gray-100">{isSummary ? '-' : t.smart_target}</span>
                  
                  {/* Sisa Hari */}
                  <span className="w-10 text-center text-slate-500 border-l border-gray-100">{isSummary ? '-' : (t.sisa_hari_efektif || 0)}</span>
                  
                  {/* Target Per Hari */}
                  <span className="w-12 text-center text-indigo-600 font-bold border-l border-gray-100">
                    {isSummary ? '-' : `${dailyTarget}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* KOLOM KANAN (Timeline) */}
        <div className="flex-1 overflow-auto relative bg-white select-none" onScroll={handleScroll}>
          <div className="relative" style={{ width: totalWidth, height: displayTasks.length * ROW_HEIGHT }}>
            
            {/* Layer 1: Grid & Weekend Shading & Horizontal Lines */}
            <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
              {displayTasks.map((_, i) => (
                <div key={i} className="w-full border-b border-gray-200" style={{ height: ROW_HEIGHT }}></div>
              ))}
            </div>
            <div className="absolute inset-0 flex pointer-events-none z-0">
              {calendarDays.map((cd, i) => (
                <div key={i} className={`border-r border-gray-200 h-full ${cd.isWeekend ? 'bg-[#f0f0f0]' : ''}`} style={{ width: DAY_WIDTH }}></div>
              ))}
            </div>

            {/* Layer 2: Status Date & Current Date Lines */}
            <div className="absolute top-0 bottom-0 border-l border-green-500 border-dashed z-10 pointer-events-none" style={{ left: getX(statusDate) }} title="Status Date"></div>
            <div className="absolute top-0 bottom-0 border-l border-red-500 z-10 pointer-events-none" style={{ left: getX(new Date().toISOString().split('T')[0]) }} title="Current Date"></div>

            {/* Layer 3: SVG Dependency Lines */}
            <svg className="absolute inset-0 pointer-events-none z-10" width={totalWidth} height={displayTasks.length * ROW_HEIGHT}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M 0 1.5 L 6 5 L 0 8.5 z" fill="#64748b" />
                </marker>
                <marker id="arrow-critical" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M 0 1.5 L 6 5 L 0 8.5 z" fill="#ef4444" />
                </marker>
              </defs>
              {svgPaths.map((p, i) => (
                <path key={i} d={p.d} fill="none" stroke={p.is_critical ? "#ef4444" : "#64748b"} strokeWidth={1.5} markerEnd={p.is_critical ? "url(#arrow-critical)" : "url(#arrow)"} />
              ))}
            </svg>

            {/* Layer 4: Task Bars & Labels */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              {displayTasks.map((t, idx) => {
                const left = getX(t.start_date);
                const width = t.duration * DAY_WIDTH;
                const top = idx * ROW_HEIGHT + 8;

                const isSummary = t.summary === 'Yes';
                const isCritical = t.is_critical;
                const progress = Number(t.progress_percent) || 0;
                const dailyTarget = calculateDailyTarget(t);

                if (t.duration === 0) {
                  return (
                    <div key={t.id} className="absolute pointer-events-auto flex items-center" style={{ left: left - 5, top: top - 1 }}>
                      <div className="w-3 h-3 bg-black rotate-45 shadow-sm z-30"></div>
                      <span className="ml-2 text-[10px] text-gray-700 font-medium whitespace-nowrap bg-white/90 px-1">{t.name}</span>
                    </div>
                  );
                }

                if (isSummary) {
                  return (
                    <div key={t.id} className="absolute pointer-events-auto group" style={{ left, width, top }}>
                      <div className="absolute top-0 w-full h-[4px] bg-black"></div>
                      <div className="absolute top-0 left-0 w-[4px] h-[10px] bg-black" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 60%)' }}></div>
                      <div className="absolute top-0 right-0 w-[4px] h-[10px] bg-black" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 0 100%)' }}></div>
                      <span className="absolute -top-3.5 text-[10px] font-semibold text-gray-700 whitespace-nowrap" style={{ left: width + 4 }}>{progress}%</span>
                    </div>
                  );
                }

                return (
                  <div key={t.id} className="absolute group" style={{ left, width: Math.max(16, width), top }}>
                    {/* Label Atas: SMART Target Per Hari */}
                    <div className="absolute -top-4 w-full text-center text-[9px] font-semibold text-indigo-600 bg-white/90 px-0.5 border border-indigo-200 rounded-sm whitespace-nowrap shadow-sm z-10">
                      🎯 {dailyTarget} {t.satuan_hsd || 'unit'}
                    </div>

                    {/* Batang Utama (MS Project Style) */}
                    <div className={`h-[18px] rounded-[2px] relative shadow-sm border ${isCritical ? 'bg-[#ff0000] border-[#cc0000]' : 'bg-[#3b82f6] border-[#2563eb]'}`}>
                      <div style={{ width: `${progress}%` }} className="bg-black/30 h-full text-[9px] text-white flex items-center justify-end pr-1 font-semibold overflow-hidden rounded-l-[1px]">
                        {progress > 20 && `${progress}%`}
                      </div>
                    </div>

                    {/* Label Tanggal Mulai (Kiri) */}
                    <span className="absolute top-[4px] text-[9px] font-semibold text-gray-500 text-right w-10 whitespace-nowrap" style={{ left: -44 }}>{fmtDate(t.start_date)}</span>

                    {/* Label Kanan (Resource & Volume) */}
                    <div className="absolute top-[3px] flex items-center gap-1 text-[10px] whitespace-nowrap" style={{ left: Math.max(16, width) + 6 }}>
                      {t.resource_names && <span className="text-gray-700 font-medium">{t.resource_names}</span>}
                      <span className="text-slate-800 font-bold bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                        Vol: {Number(t.volume) || 0} {t.satuan_hsd || ''}
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
