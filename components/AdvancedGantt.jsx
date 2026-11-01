'use client';
import { useRef, useEffect, useState } from 'react';

const DAY_WIDTH = 36;
const ROW_HEIGHT = 38;

export default function AdvancedGantt({ tasks, relations, workingDays = [1,2,3,4,5], statusDate, exceptions = [], onInlineUpdate }) {
  const leftPanelRef = useRef(null);
  const [svgPaths, setSvgPaths] = useState([]);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);

  // Sinkronisasi state lokal dengan database jika ada update dari luar
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]); // State untuk Dual Highlighting

  const displayTasks = showCriticalOnly 
    ? localTasks.filter(t => t.is_critical || t.summary === 'Yes')
    : localTasks;

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

  // 3. Hitung SVG Path
  useEffect(() => {
    const paths = [];
    const taskRects = {};

    displayTasks.forEach((t, idx) => {
      const x = getX(t.start_date);
      let dynamicWidth = t.duration * DAY_WIDTH;
      if (t.start_date && t.end_date) {
        const startX = getX(t.start_date);
        const endX = getX(t.end_date);
        if (endX >= startX) {
          dynamicWidth = (endX - startX) + DAY_WIDTH;
        }
      }
      const width = Math.max(16, dynamicWidth);
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
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch (e) { return ''; }
  };


      // HELPER: Hitung total hari kerja antara 2 tanggal
  const countWorkingDays = (startStr, endStr, workingDays, exceptions) => {
    if (!startStr || !endStr) return 1;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    
    let count = 0;
    let cur = new Date(start);
    while (cur <= end) {
      if (workingDays.includes(cur.getDay()) && !exceptions.some(e => e.exception_date === cur.toISOString().split('T')[0])) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  };

  // HELPER: Tambah N hari kerja ke tanggal tertentu (skip weekend)
  const addWorkingDays = (startStr, daysToAdd, workingDays, exceptions) => {
    if (!startStr) return '';
    let currentDate = new Date(startStr);
    let added = 0;
    
    // Jika durasi 0 atau 1, langsung return
    if (daysToAdd <= 1) return startStr;

    while (added < (daysToAdd - 1)) {
      currentDate.setDate(currentDate.getDate() + 1);
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0];
      if (workingDays.includes(dayOfWeek) && !exceptions.some(e => e.exception_date === dateStr)) {
        added++;
      }
    }
    return currentDate.toISOString().split('T')[0];
  };

  const handleDateChange = (task, field, newValue) => {
    let updates = { [field]: newValue };
    
    // Jika tanggal diubah, hitung ulang durasi (hari kerja)
    if (field === 'start_date' || field === 'end_date') {
      const start = new Date(field === 'start_date' ? newValue : task.start_date);
      const end = new Date(field === 'end_date' ? newValue : task.end_date);
      if (!isNaN(start) && !isNaN(end)) {
        let count = 0;
        let cur = new Date(start);
        while (cur <= end) {
          if (workingDays.includes(cur.getDay()) && !exceptions.some(e => e.exception_date === cur.toISOString().split('T')[0])) {
            count++;
          }
          cur.setDate(cur.getDate() + 1);
        }
        updates.duration = Math.max(1, count);
      }
    }

    // Kirim semua update (tanggal + durasi baru) ke parent component
    Object.keys(updates).forEach(key => {
      onInlineUpdate(task.id, key, updates[key]);
    });
  };

      const handleLocalInlineUpdate = (taskId, field, value) => {
    setLocalTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        let updatedTask = { ...t, [field]: value };

        // AUTO-SCHEDULE: Jika Durasi diubah, hitung ulang Tanggal Finish
        if (field === 'duration' && updatedTask.start_date) {
          const newEndDate = addWorkingDays(updatedTask.start_date, Number(value), workingDays, exceptions);
          updatedTask.end_date = newEndDate;
          onInlineUpdate(taskId, 'end_date', newEndDate); // Kirim tanggal baru ke DB
        }

        return updatedTask;
      }
      return t;
    }));
    
    // Kirim field utama ke database
    onInlineUpdate(taskId, field, value);
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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-140px)] overflow-hidden font-sans">
      
      {/* HEADER (2 Baris: Bulan & Tanggal) */}
      <div className="flex border-b border-slate-300 bg-slate-50 shrink-0 z-20">
        <div className="w-[1020px] border-r border-slate-300 flex flex-col shrink-0">
          <div className="flex justify-between items-center px-2 py-2 border-b border-slate-200 bg-slate-100">
            <div className="flex text-[11px] font-semibold text-slate-600 items-center">
              <span className="w-6 text-center" title="Task Mode">📌</span>
              <span className="w-6 text-center" title="Complete">✓</span>
              <span className="w-10 text-center" title="ID">ID</span>
              <span className="w-44 pl-1 border-l border-slate-300">Task Name</span>
              <span className="w-20 text-center border-l border-slate-300 text-slate-800">Volume</span>
              <span className="w-10 text-center border-l border-slate-300">Dur</span>
              <span className="w-[85px] text-center border-l border-slate-300">Start</span>
              <span className="w-[85px] text-center border-l border-slate-300">Finish</span>
              <span className="w-12 text-center border-l border-slate-300">Pred</span>
              <span className="w-16 text-center border-l border-slate-300">Resource</span>
              <span className="w-10 text-center border-l border-slate-300">%</span>
              <span className="w-12 text-center border-l border-slate-300">Target</span>
              <span className="w-10 text-center border-l border-slate-300">Sisa</span>
              <span className="w-12 text-center border-l border-slate-300">T/hr</span>
            </div>
            <button 
              onClick={() => setShowCriticalOnly(!showCriticalOnly)}
              className={`text-[10px] px-2 py-1 rounded font-bold border ml-2 transition-colors ${showCriticalOnly ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
            >
              {showCriticalOnly ? 'Critical' : 'All'}
            </button>
          </div>
          <div className="h-[24px] bg-slate-50"></div>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex border-b border-slate-200 bg-slate-100" style={{ width: totalWidth }}>
            {monthGroups.map((mg, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-600 border-r border-slate-300 py-1" style={{ width: mg.span * DAY_WIDTH }}>
                {mg.name}
              </div>
            ))}
          </div>
          <div className="flex bg-slate-50" style={{ width: totalWidth }}>
            {calendarDays.map((cd, i) => (
              <div key={i} className={`text-center text-[10px] border-r border-slate-200 font-medium py-1 ${cd.isWeekend ? 'bg-slate-200 text-slate-500' : 'text-slate-700'}`} style={{ width: DAY_WIDTH }}>
                {cd.date.getDate()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* KOLOM KIRI (Entry Table) */}
        <div ref={leftPanelRef} className="w-[1020px] border-r border-slate-300 overflow-y-hidden bg-white shrink-0">
          <div className="min-w-full">
            {displayTasks.map((t, idx) => {
              const dailyTarget = calculateDailyTarget(t);
              const isSummary = t.summary === 'Yes';
              const isHovered = hoveredTaskId === t.id;
              return (
                <div 
                  key={t.id} 
                  onMouseEnter={() => setHoveredTaskId(t.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  className={`flex text-[11px] items-center px-2 border-b border-slate-100 h-[38px] transition-colors cursor-pointer
                    ${isSummary ? 'bg-slate-50 font-bold' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                    ${isHovered ? 'bg-blue-50/80' : 'hover:bg-blue-50/50'}
                  `}
                >
                  <span className="w-6 text-center">
                    {t.task_mode === 'Manually Scheduled' ? <span title="Manually Scheduled">📌</span> : <span className="text-blue-500" title="Auto Scheduled">📅</span>}
                  </span>
                  <span className="w-6 text-center">
                    {t.progress_percent === 100 ? <span className="text-green-600 font-bold">✓</span> : <span className="text-slate-300">☐</span>}
                  </span>
                  <span className="w-10 font-mono text-slate-500 text-center">{t.wbs_code}</span>
                  <span className={`w-44 truncate pl-1 ${isSummary ? 'text-black' : 'text-slate-800'}`} style={{ paddingLeft: `${(t.indent_level || 0) * 12 + 4}px` }}>
                    {isSummary ? '📁 ' : '📄 '} {t.name}
                  </span>
                  <div className="w-20 px-1 border-r border-slate-100 bg-slate-50/50">
                    {!isSummary && (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          defaultValue={t.volume || 0} 
                          onBlur={(e) => handleLocalInlineUpdate(t.id, 'volume', Number(e.target.value))}
                          className="w-10 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[11px] font-bold"
                        />
                        <span className="text-[9px] text-slate-500 font-medium truncate">{t.satuan_hsd}</span>
                      </div>
                    )}
                  </div>
                  <div className="w-10 text-center border-l border-slate-100">
                    {isSummary ? <span>{t.duration}d</span> : (
                      <input type="number" defaultValue={t.duration} onBlur={(e) => handleLocalInlineUpdate(t.id, 'duration', Number(e.target.value))} className="w-8 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[11px]" />
                    )}
                  </div>
                  <div className="w-[85px] text-center border-l border-slate-100">
                    {isSummary ? <span className="text-slate-600">{fmtDate(t.start_date)}</span> : (
                      <input type="date" defaultValue={formatDateForInput(t.start_date)} onBlur={(e) => handleDateChange(t, 'start_date', e.target.value)} className="w-[75px] border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[10px]" />
                    )}
                  </div>
                  <div className="w-[85px] text-center border-l border-slate-100">
                    {isSummary ? <span className="text-slate-600">{fmtDate(t.end_date)}</span> : (
                      <input type="date" defaultValue={formatDateForInput(t.end_date)} onBlur={(e) => handleDateChange(t, 'end_date', e.target.value)} className="w-[75px] border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[10px]" />
                    )}
                  </div>
                  <span className="w-12 text-center text-slate-500 border-l border-slate-100 truncate">{t.predecessors || '-'}</span>
                  <div className="w-16 px-1 border-l border-slate-100">
                    {!isSummary && (
                      <input type="text" defaultValue={t.resource_names || ''} placeholder="..." onBlur={(e) => handleLocalInlineUpdate(t.id, 'resource_names', e.target.value)} className="w-full border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1 text-[10px] bg-transparent truncate placeholder:text-slate-300" />
                    )}
                  </div>
                  <span className="w-10 text-center font-bold text-slate-700 border-l border-slate-100">{t.progress_percent}%</span>
                  <span className="w-12 text-center font-bold text-indigo-700 border-l border-slate-100">{isSummary ? '-' : t.smart_target}</span>
                  <span className="w-10 text-center text-slate-500 border-l border-slate-100">{isSummary ? '-' : (t.sisa_hari_efektif || 0)}</span>
                  <span className="w-12 text-center text-indigo-600 font-bold border-l border-slate-100">{isSummary ? '-' : `${dailyTarget}`}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* KOLOM KANAN (Timeline) */}
        <div className="flex-1 overflow-auto relative bg-white select-none" onScroll={handleScroll}>
          <div className="relative" style={{ width: totalWidth, height: displayTasks.length * ROW_HEIGHT }}>
            
            {/* Layer 1: Grid & Weekend Shading */}
            <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
              {displayTasks.map((_, i) => (
                <div key={i} className="w-full border-b border-slate-100" style={{ height: ROW_HEIGHT }}></div>
              ))}
            </div>
            <div className="absolute inset-0 flex pointer-events-none z-0">
              {calendarDays.map((cd, i) => (
                {(() => {
                  const dateStr = cd.date.toISOString().split('T')[0];
                  const isHoliday = exceptions.some(e => e.exception_date === dateStr);
                  let bgClass = '';
                  if (isHoliday) bgClass = 'bg-red-50/50'; // Warna khusus hari libur nasional
                  else if (cd.isWeekend) bgClass = 'bg-slate-100'; // Warna weekend
                  return <div key={i} className={`border-r border-slate-200 h-full ${bgClass}`} style={{ width: DAY_WIDTH }}></div>;
                })()}
              ))}
            </div>

            {/* Layer 2: Status Date Lines */}
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
                let dynamicWidth = t.duration * DAY_WIDTH;
      if (t.start_date && t.end_date) {
        const startX = getX(t.start_date);
        const endX = getX(t.end_date);
        if (endX >= startX) {
          dynamicWidth = (endX - startX) + DAY_WIDTH;
        }
      }
      const width = Math.max(16, dynamicWidth);
                const top = idx * ROW_HEIGHT + 8;
                const isHovered = hoveredTaskId === t.id; // Dual Highlight

                const isSummary = t.summary === 'Yes';
                const isCritical = t.is_critical;
                const progress = Number(t.progress_percent) || 0;
                const dailyTarget = calculateDailyTarget(t);

                if (t.duration === 0) {
                  return (
                    <div key={t.id} className={`absolute pointer-events-auto flex items-center ${isHovered ? 'bg-blue-100/50' : ''}`} style={{ left: left - 5, top: top - 1 }}>
                      <div className="w-3 h-3 bg-black rotate-45 shadow-sm z-30"></div>
                      <span className="ml-2 text-[10px] text-slate-700 font-medium whitespace-nowrap bg-white/90 px-1">{t.name}</span>
                    </div>
                  );
                }

                if (isSummary) {
                  return (
                    <div key={t.id} className={`absolute pointer-events-auto group ${isHovered ? 'bg-blue-100/30' : ''}`} style={{ left, width, top }}>
                      <div className="absolute top-0 w-full h-[4px] bg-slate-800"></div>
                      <div className="absolute top-0 left-0 w-[4px] h-[10px] bg-slate-800" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 60%)' }}></div>
                      <div className="absolute top-0 right-0 w-[4px] h-[10px] bg-slate-800" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 0 100%)' }}></div>
                      <span className="absolute -top-3.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap" style={{ left: width + 4 }}>{progress}%</span>
                    </div>
                  );
                }

                return (
                  <div key={t.id} className={`absolute group ${isHovered ? 'z-30' : ''}`} style={{ left, width: Math.max(16, width), top }}>
                    <div className="absolute -top-4 w-full text-center text-[9px] font-semibold text-indigo-600 bg-white/90 px-0.5 border border-indigo-200 rounded-sm whitespace-nowrap shadow-sm z-10">
                      🎯 {dailyTarget} {t.satuan_hsd || 'unit'}
                    </div>

                    <div className={`h-[18px] rounded-[2px] relative shadow-sm border ${isCritical ? 'bg-red-500 border-red-600' : 'bg-blue-500 border-blue-600'} ${isHovered ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
                      <div style={{ width: `${progress}%` }} className="bg-black/30 h-full text-[9px] text-white flex items-center justify-end pr-1 font-semibold overflow-hidden rounded-l-[1px]">
                        {progress > 20 && `${progress}%`}
                      </div>
                    </div>

                    <span className="absolute top-[4px] text-[9px] font-semibold text-slate-500 text-right w-10 whitespace-nowrap" style={{ left: -44 }}>{fmtDate(t.start_date)}</span>

                    <div className="absolute top-[3px] flex items-center gap-1 text-[10px] whitespace-nowrap" style={{ left: Math.max(16, width) + 6 }}>
                      {t.resource_names && <span className="text-slate-700 font-medium">{t.resource_names}</span>}
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








