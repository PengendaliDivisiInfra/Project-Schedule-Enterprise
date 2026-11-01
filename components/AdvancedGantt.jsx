/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
'use client';
import { useRef, useEffect, useState } from 'react';

const ROW_HEIGHT = 38;
const BUFFER_SIZE = 10; // Jumlah baris ekstra di atas/bawah layar

export default function AdvancedGantt({ tasks, relations, workingDays = [1,2,3,4,5], statusDate, exceptions = [], onInlineUpdate, onRefresh }) {
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const [svgPaths, setSvgPaths] = useState([]);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [zoomLevel, setZoomLevel] = useState('day');
  
  // VIRTUAL SCROLLING STATES
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Deteksi tinggi layar untuk virtual scrolling
  useEffect(() => {
    const handleResize = () => {
      if (rightPanelRef.current) setViewportHeight(rightPanelRef.current.clientHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayTasks = showCriticalOnly
    ? localTasks.filter(t => t.is_critical || t.summary === 'Yes')
    : localTasks;

  // --- LOGIKA VIRTUAL SCROLLING ---
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(displayTasks.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_SIZE);
  const visibleTasks = displayTasks.slice(startIndex, endIndex);

  // 1. Generate Calendar Days
  let minDate = new Date();
  let maxDate = new Date();
  displayTasks.forEach(t => {
    if (t.start_date) { const d = new Date(t.start_date); if (d < minDate) minDate = d; }
    if (t.end_date) { const d = new Date(t.end_date); if (d > maxDate) maxDate = d; }
  });
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);

  const calendarDays = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
    const isWorking = workingDays.includes(cur.getDay());
    calendarDays.push({ date: new Date(cur), isWeekend: !isWorking });
    cur.setDate(cur.getDate() + 1);
  }

  const pixelsPerDay = zoomLevel === 'day' ? 36 : zoomLevel === 'week' ? 16 : 4;
  const totalWidth = calendarDays.length * pixelsPerDay;

  const getWeekNumber = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  };

  const topGroups = [];
  let currentGroup = null;
  calendarDays.forEach((cd) => {
    let groupName = zoomLevel === 'month' ? cd.date.getFullYear().toString() : cd.date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    if (!currentGroup || currentGroup.name !== groupName) {
      currentGroup = { name: groupName, span: 1 };
      topGroups.push(currentGroup);
    } else {
      currentGroup.span++;
    }
  });

  const getX = (dateStr) => {
    if (!dateStr) return 0;
    let targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) return 0; // Failsafe jika tanggal invalid
    targetDate.setHours(0,0,0,0);
    let current = new Date(minDate);
    current.setHours(0,0,0,0);
    let daysDiff = Math.round((targetDate - current) / (1000 * 60 * 60 * 24));
    return daysDiff * pixelsPerDay;
  };

  // 2. Hitung SVG Paths (Hanya render yang berpotensi terlihat)
  useEffect(() => {
    const paths = [];
    const taskRects = {};

    displayTasks.forEach((t, idx) => {
      const x = getX(t.start_date);
      let width = t.duration * pixelsPerDay;
      if (t.start_date && t.end_date) {
        const startX = getX(t.start_date);
        const endX = getX(t.end_date);
        if (endX >= startX) width = (endX - startX) + pixelsPerDay;
      }
      width = Math.max(8, width);
      const y = idx * ROW_HEIGHT;
      
      // Simpan koordinat SVG (Mencegah x negatif)
      taskRects[t.wbs_code] = { x: Math.max(0, x), y, width, index: idx };
    });

    relations.forEach(rel => {
      const from = taskRects[rel.from];
      const to = taskRects[rel.to];
      if (!from || !to) return;

      // VIRTUAL SCROLL CHECK: Hanya hitung path jika salah satu node ada di area pandang + buffer
      if (from.index < startIndex - BUFFER_SIZE && to.index < startIndex - BUFFER_SIZE) return;
      if (from.index > endIndex + BUFFER_SIZE && to.index > endIndex + BUFFER_SIZE) return;

      let sourceX, sourceY, targetX, targetY;
      const fromCenterY = from.y + (ROW_HEIGHT / 2);
      const toCenterY = to.y + (ROW_HEIGHT / 2);

      if (rel.type === 'FS') { sourceX = from.x + from.width; sourceY = fromCenterY; targetX = to.x; targetY = toCenterY; }
      else if (rel.type === 'SS') { sourceX = from.x; sourceY = fromCenterY; targetX = to.x; targetY = toCenterY; }
      else if (rel.type === 'FF') { sourceX = from.x + from.width; sourceY = fromCenterY; targetX = to.x + to.width; targetY = toCenterY; }
      else if (rel.type === 'SF') { sourceX = from.x; sourceY = fromCenterY; targetX = to.x + to.width; targetY = toCenterY; }

      const points = [[sourceX, sourceY]];
      const paddingX = zoomLevel === 'day' ? 12 : 4;

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
  }, [displayTasks, relations, zoomLevel, startIndex, endIndex, pixelsPerDay]);

  const handleScroll = (e) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    if (leftPanelRef.current) {
      leftPanelRef.current.scrollTop = newScrollTop;
    }
  };

  const fmtDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-';
  
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try { const d = new Date(dateString); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; } catch (e) { return ''; }
  };

  const countWorkingDays = (startStr, endStr, workingDays, exceptions) => {
    if (!startStr || !endStr) return 1;
    let count = 0; let cur = new Date(startStr); const end = new Date(endStr);
    while (cur <= end) {
      if (workingDays.includes(cur.getDay()) && !exceptions.some(e => e.exception_date === cur.toISOString().split('T')[0])) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  };

  const addWorkingDays = (startStr, daysToAdd, workingDays, exceptions) => {
    if (!startStr) return '';
    let currentDate = new Date(startStr); let added = 0;
    while (!workingDays.includes(currentDate.getDay()) || exceptions.some(e => e.exception_date === currentDate.toISOString().split('T')[0])) currentDate.setDate(currentDate.getDate() + 1);
    if (daysToAdd <= 1) return currentDate.toISOString().split('T')[0];
    while (added < (daysToAdd - 1)) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (workingDays.includes(currentDate.getDay()) && !exceptions.some(e => e.exception_date === currentDate.toISOString().split('T')[0])) added++;
    }
    return currentDate.toISOString().split('T')[0];
  };

  const snapToWorkingDay = (dateStr, workingDays, exceptions) => {
    if (!dateStr) return '';
    let d = new Date(dateStr);
    while (!workingDays.includes(d.getDay()) || exceptions.some(e => e.exception_date === d.toISOString().split('T')[0])) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const handleDateChange = (task, field, newValue) => {
    let startStr = field === 'start_date' ? newValue : task.start_date;
    let endStr = field === 'end_date' ? newValue : task.end_date;
    let newDuration = task.duration;

    if (field === 'start_date') {
      startStr = snapToWorkingDay(startStr, workingDays, exceptions);
      newDuration = Number(task.duration) || 1;
      endStr = addWorkingDays(startStr, newDuration, workingDays, exceptions);
    } else if (field === 'end_date') {
      endStr = snapToWorkingDay(endStr, workingDays, exceptions);
      newDuration = countWorkingDays(startStr, endStr, workingDays, exceptions);
    }

    setLocalTasks(prev => {
      let updated = prev.map(t => t.id === task.id ? { ...t, start_date: startStr, end_date: endStr, duration: newDuration } : t);
      
      if (task.parent_id) {
        const siblings = updated.filter(t => t.parent_id === task.parent_id);
        if (siblings.length > 0) {
          const minStart = siblings.reduce((min, s) => new Date(s.start_date) < new Date(min) ? s.start_date : min, siblings[0].start_date);
          const maxEnd = siblings.reduce((max, s) => new Date(s.end_date) > new Date(max) ? s.end_date : max, siblings[0].end_date);
          const pDur = countWorkingDays(minStart, maxEnd, workingDays, exceptions);
          updated = updated.map(t => {
            if (t.id === task.parent_id) {
              return { ...t, start_date: minStart, end_date: maxEnd, duration: pDur };
            }
            return t;
          });
        }
      }
      return updated;
    });

    onInlineUpdate(task.id, 'start_date', startStr); 
    onInlineUpdate(task.id, 'end_date', endStr);
    if (newDuration !== task.duration) onInlineUpdate(task.id, 'duration', newDuration);
  };

  const handleLocalInlineUpdate = (taskId, field, value) => {
    setLocalTasks(prev => {
      let updated = prev.map(t => {
        if (t.id === taskId) {
          let updatedTask = { ...t, [field]: value };
          if (field === 'duration') {
            let startStr = snapToWorkingDay(updatedTask.start_date, workingDays, exceptions);
            const newEndDate = addWorkingDays(startStr, Number(value), workingDays, exceptions);
            updatedTask.start_date = startStr; updatedTask.end_date = newEndDate;
            onInlineUpdate(taskId, 'start_date', startStr); onInlineUpdate(taskId, 'end_date', newEndDate);
          }
          return updatedTask;
        }
        return t;
      });

      const child = updated.find(t => t.id === taskId);
      if (child && child.parent_id) {
        const siblings = updated.filter(t => t.parent_id === child.parent_id);
        if (siblings.length > 0) {
          const minStart = siblings.reduce((min, s) => new Date(s.start_date) < new Date(min) ? s.start_date : min, siblings[0].start_date);
          const maxEnd = siblings.reduce((max, s) => new Date(s.end_date) > new Date(max) ? s.end_date : max, siblings[0].end_date);
          const pDur = countWorkingDays(minStart, maxEnd, workingDays, exceptions);
          
          updated = updated.map(t => {
            if (t.id === child.parent_id) {
              return { ...t, start_date: minStart, end_date: maxEnd, duration: pDur };
            }
            return t;
          });
        }
      }
      return updated;
    });
    onInlineUpdate(taskId, field, value);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-140px)] overflow-hidden font-sans">
      
      <div className="flex border-b border-slate-300 bg-slate-50 shrink-0 z-20">
        <div className="w-[1020px] border-r border-slate-300 flex flex-col shrink-0">
          <div className="flex justify-between items-center px-2 py-2 border-b border-slate-200 bg-slate-100">
            <div className="flex text-[11px] font-semibold text-slate-600 items-center">
              <span className="w-6 text-center" title="Mode">📌</span>
              <span className="w-6 text-center" title="Done">✓</span>
              <span className="w-10 text-center" title="ID">ID</span>
              <span className="w-44 pl-1 border-l border-slate-300">Task Name</span>
              <span className="w-20 text-center border-l border-slate-300">Volume</span>
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
            
            <div className="flex items-center gap-2 ml-2">
              <div className="relative">
                <select
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 hover:border-slate-400 rounded shadow-sm py-1 pl-7 pr-6 text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer transition-colors"
                >
                  <option value="day">Skala: Hari</option>
                  <option value="week">Skala: Minggu</option>
                  <option value="month">Skala: Bulan</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                  <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <button onClick={() => setShowCriticalOnly(!showCriticalOnly)} className={`text-[10px] px-2 py-1 rounded font-bold border ${showCriticalOnly ? 'bg-red-500 text-white' : 'bg-white text-slate-600'}`}>{showCriticalOnly ? 'Critical' : 'All'}</button>
            </div>
          </div>
          <div className="h-[24px] bg-slate-50"></div>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex border-b border-slate-200 bg-slate-100" style={{ width: totalWidth }}>
            {topGroups.map((mg, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-600 border-r border-slate-300 py-1 truncate" style={{ width: mg.span * pixelsPerDay }}>{mg.name}</div>
            ))}
          </div>
          <div className="flex bg-slate-50" style={{ width: totalWidth }}>
            {calendarDays.map((cd, i) => {
              let showLabel = false; let label = '';
              if (zoomLevel === 'day') { showLabel = true; label = cd.date.getDate(); }
              else if (zoomLevel === 'week' && cd.date.getDay() === 1) { showLabel = true; label = `W${getWeekNumber(cd.date)}`; }
              else if (zoomLevel === 'month' && cd.date.getDate() === 1) { showLabel = true; label = cd.date.toLocaleDateString('id-ID', { month: 'short' }); }
              return (
                <div key={i} className={`text-center text-[10px] border-r border-slate-200 font-medium py-1 ${cd.isWeekend && zoomLevel === 'day' ? 'bg-slate-200 text-slate-500' : 'text-slate-700'}`} style={{ width: pixelsPerDay }}>
                  {showLabel ? label : ''}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div ref={leftPanelRef} className="w-[1020px] border-r border-slate-300 overflow-y-hidden bg-white shrink-0">
          <div className="relative" style={{ height: displayTasks.length * ROW_HEIGHT }}>
            {visibleTasks.map((t, idx) => {
              const actualIndex = startIndex + idx;
              const top = actualIndex * ROW_HEIGHT;
              const isSummary = t.summary === 'Yes';
              const isHovered = hoveredTaskId === t.id;
              
              return (
                <div key={t.id} onMouseEnter={() => setHoveredTaskId(t.id)} onMouseLeave={() => setHoveredTaskId(null)}
                  style={{ top, height: ROW_HEIGHT }}
                  className={`absolute w-full flex text-[11px] items-center px-2 border-b border-slate-100 transition-colors cursor-pointer
                    ${isSummary ? 'bg-slate-50 font-bold' : actualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${isHovered ? 'bg-blue-50/80' : 'hover:bg-blue-50/50'}`}>
                  <span className="w-6 text-center">{t.task_mode === 'Manually Scheduled' ? '📌' : '📅'}</span>
                  <span className="w-6 text-center">{t.progress_percent === 100 ? <span className="text-green-600 font-bold">✓</span> : <span className="text-slate-300">☐</span>}</span>
                  <span className="w-10 font-mono text-slate-500 text-center">{t.wbs_code}</span>
                  <span className={`w-44 truncate pl-1 ${isSummary ? 'text-black' : 'text-slate-800'}`} style={{ paddingLeft: `${(t.indent_level || 0) * 12 + 4}px` }}>{isSummary ? '📁 ' : '📄 '} {t.name}</span>
                  <div className="w-20 px-1 border-r border-slate-100 bg-slate-50/50">
                    {!isSummary && (
                      <div className="flex items-center gap-1">
                        <input type="number" defaultValue={t.volume || 0} onBlur={(e) => handleLocalInlineUpdate(t.id, 'volume', Number(e.target.value))} className="w-10 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[11px] font-bold" onFocus={(e) => e.target.select()} />
                        <span className="text-[9px] text-slate-500 font-medium truncate">{t.satuan_hsd}</span>
                      </div>
                    )}
                  </div>
                  <div className="w-10 text-center border-l border-slate-100">
                    {isSummary ? <span>{t.duration}d</span> : (
                      <input type="number" key={`dur-${t.duration}`} defaultValue={t.duration} onBlur={(e) => handleLocalInlineUpdate(t.id, 'duration', Number(e.target.value))} className="w-8 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[11px]" onFocus={(e) => e.target.select()} />
                    )}
                  </div>
                  <div className="w-[85px] text-center border-l border-slate-100">
                    {(() => {
                      const hasPredecessor = t.predecessors && t.predecessors.trim() !== '';
                      const isLocked = isSummary || hasPredecessor;
                      return (
                        <input type="date" key={`start-${t.start_date}`} defaultValue={formatDateForInput(t.start_date)} onBlur={(e) => handleDateChange(t, 'start_date', e.target.value)} disabled={isLocked} title={hasPredecessor ? "Terkunci oleh Predecessor" : ""} className={`w-[75px] border border-transparent focus:border-blue-500 rounded text-center bg-transparent text-[10px] ${isLocked ? 'text-slate-500 cursor-not-allowed bg-slate-100' : 'hover:border-slate-300'}`} />
                      );
                    })()}
                  </div>
                  <div className="w-[85px] text-center border-l border-slate-100">
                    {isSummary ? <span className="text-slate-600">{fmtDate(t.end_date)}</span> : (
                      <input type="date" key={`end-${t.end_date}`} defaultValue={formatDateForInput(t.end_date)} onBlur={(e) => handleDateChange(t, 'end_date', e.target.value)} className="w-[75px] border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[10px]" />
                    )}
                  </div>
                  <div className="w-12 px-1 border-l border-slate-100">
                    {!isSummary ? (
                      <input type="text" key={`pred-${t.predecessors}`} defaultValue={t.predecessors || ''} placeholder="1.1FS+2" onBlur={(e) => handleLocalInlineUpdate(t.id, 'predecessors', e.target.value)} className="w-full border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[10px] font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal" />
                    ) : (
                      <div className="text-center text-slate-300 text-[10px]">-</div>
                    )}
                  </div>
                  <div className="w-16 px-1 border-l border-slate-100">
                    {!isSummary && (
                      <input type="text" defaultValue={t.resource_names || ''} placeholder="..." onBlur={(e) => handleLocalInlineUpdate(t.id, 'resource_names', e.target.value)} className="w-full border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1 text-[10px] bg-transparent truncate placeholder:text-slate-300" />
                    )}
                  </div>
                  <span className="w-10 text-center font-bold text-slate-700 border-l border-slate-100">{t.progress_percent}%</span>
                  <span className="w-12 text-center font-bold text-indigo-700 border-l border-slate-100">{isSummary ? '-' : t.smart_target}</span>
                  <span className="w-10 text-center text-slate-500 border-l border-slate-100">{isSummary ? '-' : (t.sisa_hari_efektif || 0)}</span>
                  <span className="w-12 text-center text-indigo-600 font-bold border-l border-slate-100">{isSummary ? '-' : `0`}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={rightPanelRef} className="flex-1 overflow-auto relative bg-white select-none" onScroll={handleScroll}>
          <div className="relative" style={{ width: totalWidth, height: displayTasks.length * ROW_HEIGHT }}>
            
            <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
              {Array.from({ length: Math.ceil(displayTasks.length / 50) }).map((_, i) => (
                <div key={i} className="w-full flex flex-col" style={{ height: 50 * ROW_HEIGHT }}>
                  {Array.from({ length: 50 }).map((_, j) => (
                    <div key={j} className="w-full border-b border-slate-200" style={{ height: ROW_HEIGHT }}></div>
                  ))}
                </div>
              ))}
            </div>

            <div className="absolute inset-0 flex pointer-events-none z-0">
              {calendarDays.map((cd, i) => {
                const dateStr = cd.date.toISOString().split('T')[0];
                const isHoliday = exceptions.some(e => e.exception_date === dateStr);
                let bgClass = isHoliday ? 'bg-red-50/50' : (zoomLevel === 'day' && cd.isWeekend) ? 'bg-slate-50' : '';
                let borderClass = (zoomLevel === 'week' && cd.date.getDay() === 1) ? 'border-r border-slate-300' : (zoomLevel === 'month' && cd.date.getDate() === 1) ? 'border-r border-slate-400' : 'border-r border-slate-100';
                return <div key={i} className={`${borderClass} h-full ${bgClass}`} style={{ width: pixelsPerDay }}></div>;
              })}
            </div>

            <div className="absolute top-0 bottom-0 border-l border-green-500 border-dashed z-10 pointer-events-none" style={{ left: getX(statusDate) }} title="Status Date"></div>
            <div className="absolute top-0 bottom-0 border-l border-red-500 z-10 pointer-events-none" style={{ left: getX(new Date().toISOString().split('T')[0]) }} title="Current Date"></div>
            
            <svg className="absolute inset-0 pointer-events-none z-10" width={totalWidth} height={displayTasks.length * ROW_HEIGHT}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 1.5 L 6 5 L 0 8.5 z" fill="#64748b" /></marker>
                <marker id="arrow-critical" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 1.5 L 6 5 L 0 8.5 z" fill="#ef4444" /></marker>
              </defs>
              {svgPaths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.is_critical ? "#ef4444" : "#64748b"} strokeWidth={1.5} markerEnd={p.is_critical ? "url(#arrow-critical)" : "url(#arrow)"} />)}
            </svg>

            <div className="absolute inset-0 z-20 pointer-events-none">
              {visibleTasks.map((t, idx) => {
                const actualIndex = startIndex + idx;
                const rawLeft = getX(t.start_date);
                const left = Math.max(0, rawLeft);
                
                let width = t.duration * pixelsPerDay;
                if (t.start_date && t.end_date) {
                  const endX = getX(t.end_date);
                  if (endX >= rawLeft) {
                    width = (endX - rawLeft) + pixelsPerDay;
                  }
                }
                // Jika bar mulai sebelum batas kiri layar (x negatif), sesuaikan lebarnya agar tidak overflow
                if (rawLeft < 0) {
                  width = width + rawLeft; 
                }
                width = Math.max(8, width);
                
                const top = actualIndex * ROW_HEIGHT + 6; 
                const isHovered = hoveredTaskId === t.id;
                const isSummary = t.summary === 'Yes';
                const isCritical = t.is_critical;
                const progress = Number(t.progress_percent) || 0;

                if (t.duration === 0) return <div key={t.id} className="absolute pointer-events-auto flex items-center" style={{ left: left - 5, top: top + 2 }}><div className="w-3 h-3 bg-black rotate-45 shadow-sm z-30"></div></div>;
                if (isSummary) return <div key={t.id} className="absolute pointer-events-auto" style={{ left, width, top: top + 2 }}><div className="absolute top-0 w-full h-[4px] bg-slate-800"></div><div className="absolute top-0 left-0 w-[4px] h-[10px] bg-slate-800" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 60%)' }}></div><div className="absolute top-0 right-0 w-[4px] h-[10px] bg-slate-800" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 0 100%)' }}></div></div>;

                return (
                  <div key={t.id} className={`absolute group ${isHovered ? 'z-30' : ''}`} style={{ left, width, top }}>
                    <div className={`h-[16px] rounded-[2px] relative shadow-sm border ${isCritical ? 'bg-red-500 border-red-600' : 'bg-blue-500 border-blue-600'} ${isHovered ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
                      <div style={{ width: `${progress}%` }} className="bg-black/30 h-full text-[8px] text-white flex items-center justify-end pr-1 font-semibold overflow-hidden rounded-l-[1px]">
                        {progress > 20 && `${progress}%`}
                      </div>
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
