/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
'use client';
import { useRef, useEffect, useState, useMemo } from 'react';
import { Folder, FileText, Pin, Settings, Calendar } from 'lucide-react';
import ResourceHistogram from './ResourceHistogram';
import { calculateResourceHistogram } from '../lib/histogramCalculator';

const ROW_HEIGHT = 38;
const BUFFER_SIZE = 10;

export default function AdvancedGantt({ 
  tasks, relations, taskAssignments = [], resources = [], 
  workingDays = [1,2,3,4,5], statusDate, exceptions = [], onInlineUpdate, onRefresh 
}) {
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const [svgPaths, setSvgPaths] = useState([]);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [zoomLevel, setZoomLevel] = useState('day');
  
  const [showHistogram, setShowHistogram] = useState(true);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const [dataDate, setDataDate] = useState(statusDate || new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

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

  const histogramData = useMemo(
    () => calculateResourceHistogram(localTasks, taskAssignments, resources, workingDays, exceptions),
    [localTasks, taskAssignments, resources, workingDays, exceptions]
  );

  const totalTasks = localTasks.length;
  const criticalTasks = localTasks.filter(t => t.is_critical && t.summary !== 'Yes').length;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(displayTasks.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_SIZE);
  const visibleTasks = displayTasks.slice(startIndex, endIndex);

  let minDate = null;
  let maxDate = null;
  
  displayTasks.forEach(t => {
    const s = t.early_start || t.start_date;
    const e = t.early_finish || t.end_date;
    if (s) { const d = new Date(s); if (!minDate || d < minDate) minDate = d; }
    if (e) { const d = new Date(e); if (!maxDate || d > maxDate) maxDate = d; }
  });

  if (!minDate) minDate = new Date();
  if (!maxDate) maxDate = new Date();

  minDate = new Date(minDate);
  minDate.setDate(minDate.getDate() - 7);
  maxDate = new Date(maxDate);
  maxDate.setDate(maxDate.getDate() + 14);

  const calendarDays = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
    const isWorking = workingDays.includes(cur.getDay());
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = y + '-' + m + '-' + d;
    calendarDays.push({ date: new Date(cur), dateStr, isWeekend: !isWorking });
    cur.setDate(cur.getDate() + 1);
  }

  const pixelsPerDay = zoomLevel === 'day' ? 36 : zoomLevel === 'week' ? 16 : 4;
  const totalWidth = calendarDays.length * pixelsPerDay;

  useEffect(() => {
    if (rightPanelRef.current && displayTasks.length > 0) {
      let firstTaskDate = null;
      displayTasks.forEach(t => {
        const s = t.early_start || t.start_date;
        if (s) {
          const d = new Date(s);
          if (!firstTaskDate || d < firstTaskDate) firstTaskDate = d;
        }
      });
      if (firstTaskDate) {
        const mDate = new Date(minDate);
        mDate.setHours(0,0,0,0);
        const fDate = new Date(firstTaskDate);
        fDate.setHours(0,0,0,0);
        const daysDiff = Math.round((fDate - mDate) / (1000 * 60 * 60 * 24));
        const scrollPos = Math.max(0, (daysDiff - 2) * pixelsPerDay);
        rightPanelRef.current.scrollLeft = scrollPos;
        setScrollLeft(scrollPos);
      }
    }
  }, [zoomLevel, minDate.getTime(), displayTasks.length]);

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
    if (isNaN(targetDate.getTime())) return 0;
    targetDate.setHours(0,0,0,0);
    let current = new Date(minDate);
    current.setHours(0,0,0,0);
    let daysDiff = Math.round((targetDate - current) / (1000 * 60 * 60 * 24));
    return daysDiff * pixelsPerDay;
  };

  useEffect(() => {
    const paths = [];
    const taskRects = {};

    displayTasks.forEach((t, idx) => {
      const startD = t.early_start || t.start_date;
      const endD = t.early_finish || t.end_date;
      if (!startD || !endD) return;

      const x = getX(startD);
      let width = t.duration * pixelsPerDay;
      const startX = getX(startD);
      const endX = getX(endD);
      
      if (endX >= startX) width = (endX - startX) + pixelsPerDay;
      width = Math.max(8, width);
      
      const y = idx * ROW_HEIGHT;
      taskRects[t.wbs_code] = { x: Math.max(0, x), y, width, index: idx };
    });

    relations.forEach(rel => {
      const from = taskRects[rel.from];
      const to = taskRects[rel.to];
      if (!from || !to) return;
      if (from.index < startIndex - BUFFER_SIZE && to.index < startIndex - BUFFER_SIZE) return;
      if (from.index > endIndex + BUFFER_SIZE && to.index > endIndex + BUFFER_SIZE) return;

      let sourceX, sourceY, targetX, targetY;
      const fromCenterY = from.y + (ROW_HEIGHT / 2);
      const toCenterY = to.y + (ROW_HEIGHT / 2);
      const typeUpper = rel.type.toUpperCase();
      const ARROW_PADDING = 4; 

      if (typeUpper === 'FS') { sourceX = from.x + from.width; sourceY = fromCenterY; targetX = to.x - ARROW_PADDING; targetY = toCenterY; }
      else if (typeUpper === 'SS') { sourceX = from.x; sourceY = fromCenterY; targetX = to.x - ARROW_PADDING; targetY = toCenterY; }
      else if (typeUpper === 'FF') { sourceX = from.x + from.width; sourceY = fromCenterY; targetX = to.x + to.width + ARROW_PADDING; targetY = toCenterY; }
      else if (typeUpper === 'SF') { sourceX = from.x; sourceY = fromCenterY; targetX = to.x + to.width + ARROW_PADDING; targetY = toCenterY; }

      const points = [[sourceX, sourceY]];
      if (targetX < sourceX + 20) {
        const midY = sourceY + (ROW_HEIGHT / 2);
        points.push([sourceX, midY]); 
        points.push([targetX - 15, midY]); 
        points.push([targetX - 15, targetY]);
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
  }, [displayTasks, relations, zoomLevel, startIndex, endIndex, pixelsPerDay, minDate.getTime()]);

  const handleScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const fmtDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try { const d = new Date(dateString); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; } catch (e) { return ''; }
  };

  const countWorkingDays = (startStr, endStr, workingDays, exceptions) => {
    if (!startStr || !endStr) return 1;
    let count = 0; let cur = new Date(startStr); const end = new Date(endStr);
    cur.setHours(12,0,0,0); end.setHours(12,0,0,0);
    while (cur <= end) {
      if (workingDays.includes(cur.getDay()) && !exceptions.some(e => e.exception_date === cur.toISOString().split('T')[0])) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  };

  const addWorkingDays = (startStr, daysToAdd, workingDays, exceptions) => {
    if (!startStr) return '';
    let currentDate = new Date(startStr); let added = 0;
    currentDate.setHours(12,0,0,0);
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
    d.setHours(12,0,0,0);
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
      let updated = prev.map(t => t.id === task.id ? { ...t, start_date: startStr, end_date: endStr, duration: newDuration, task_mode: 'Manually Scheduled' } : t);
      if (task.parent_id) {
        const siblings = updated.filter(t => t.parent_id === task.parent_id);
        if (siblings.length > 0) {
          const minStart = siblings.reduce((min, s) => new Date(s.start_date) < new Date(min) ? s.start_date : min, siblings[0].start_date);
          const maxEnd = siblings.reduce((max, s) => new Date(s.end_date) > new Date(max) ? s.end_date : max, siblings[0].end_date);
          const pDur = countWorkingDays(minStart, maxEnd, workingDays, exceptions);
          updated = updated.map(t => {
            if (t.id === task.parent_id) return { ...t, start_date: minStart, end_date: maxEnd, duration: pDur };
            return t;
          });
        }
      }
      return updated;
    });
    onInlineUpdate(task.id, 'BULK_UPDATE', { start_date: startStr, end_date: endStr, duration: newDuration, task_mode: 'Manually Scheduled' });
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
            if (t.id === child.parent_id) return { ...t, start_date: minStart, end_date: maxEnd, duration: pDur };
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
      
      {/* TOOLBAR ATAS */}
      <div className="flex justify-between items-center px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-800">Project Overview</span>
          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">Tasks: {totalTasks}</span>
          <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs">Critical: {criticalTasks}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-[11px] font-bold text-slate-600">Data Date:</span>
            <input 
              type="date" 
              value={dataDate} 
              onChange={(e) => setDataDate(e.target.value)} 
              className="bg-transparent border-none text-[11px] font-bold text-indigo-700 focus:outline-none cursor-pointer"
            />
          </div>

          <div className="relative">
            <select value={zoomLevel} onChange={(e) => setZoomLevel(e.target.value)} className="appearance-none bg-white border border-slate-300 hover:border-slate-400 rounded shadow-sm py-1.5 pl-3 pr-8 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              <option value="day">Skala: Hari</option>
              <option value="week">Skala: Minggu</option>
              <option value="month">Skala: Bulan</option>
            </select>
          </div>
          
          <button onClick={() => setShowCriticalOnly(!showCriticalOnly)} className={`text-[11px] px-3 py-1.5 rounded font-bold border transition-colors ${showCriticalOnly ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            {showCriticalOnly ? 'Hanya Critical Path' : 'Tampilkan Semua'}
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-300 bg-slate-50 shrink-0 relative z-10">
        {/* LEBAR PANEL KIRI DISESUAIKAN MENJADI 938px (Cost Dihapus) */}
        <div className="w-[938px] border-r border-slate-300 flex flex-col shrink-0">
          <div className="flex justify-between items-center px-2 py-2 border-b border-slate-200 bg-slate-100">
            <div className="flex text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center w-full">
              <span className="w-6 text-center" title="Mode">M</span>
              <span className="w-6 text-center" title="Done">✓</span>
              <span className="w-10 text-center" title="ID">WBS</span>
              <span className="w-44 pl-2 border-l border-slate-300">Task Name</span>
              <span className="w-32 text-center border-l border-slate-300">Volume</span>
              <span className="w-10 text-center border-l border-slate-300">Dur</span>
              <span className="w-[85px] text-center border-l border-slate-300">Start</span>
              <span className="w-[85px] text-center border-l border-slate-300">Finish</span>
              <span className="w-12 text-center border-l border-slate-300">Pred</span>
              <span className="w-10 text-center border-l border-slate-300">%</span>
              <span className="w-12 text-center border-l border-slate-300">Target</span>
              <span className="w-12 text-center border-l border-slate-300">Sisa</span>
              <span className="w-12 text-center border-l border-slate-300">T/hr</span>
              <span className="w-14 text-center border-l border-slate-300">Varian</span>
              <span className="w-12 text-center border-l border-slate-300">Slack</span>
            </div>
          </div>
          <div className="h-[24px] bg-slate-50"></div>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex border-b border-slate-200 bg-slate-100" style={{ width: totalWidth }}>
            {topGroups.map((mg, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-500 border-r border-slate-300 py-1 truncate" style={{ width: mg.span * pixelsPerDay }}>{mg.name}</div>
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
        {/* PANEL KIRI BODY (Data Task) */}
        <div ref={leftPanelRef} className="w-[938px] border-r border-slate-300 overflow-hidden bg-white shrink-0 relative">
          <div className="relative" style={{ height: displayTasks.length * ROW_HEIGHT, transform: `translateY(-${scrollTop}px)` }}>
            {displayTasks.map((t, idx) => {
              const actualIndex = idx; 
              const top = actualIndex * ROW_HEIGHT;
              const isSummary = t.summary === 'Yes';
              const isHovered = hoveredTaskId === t.id;

              if (actualIndex < startIndex - BUFFER_SIZE || actualIndex > endIndex + BUFFER_SIZE) return null;
              
              return (
                <div key={t.id} onMouseEnter={() => setHoveredTaskId(t.id)} onMouseLeave={() => setHoveredTaskId(null)}
                  style={{ top, height: ROW_HEIGHT }}
                  className={`absolute w-full flex text-[11px] items-center px-2 border-b border-slate-100 transition-colors cursor-pointer hover:bg-blue-50/80
                    ${isSummary ? 'bg-slate-50 font-bold' : actualIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${isHovered ? 'bg-blue-50/80' : 'hover:bg-blue-50/50'}`}>
                  <span className="w-6 flex justify-center text-center">
                    {t.task_mode === 'Manually Scheduled' ? <Pin className="w-3.5 h-3.5 text-amber-600" /> : <Settings className="w-3.5 h-3.5 text-blue-500" />}
                  </span>
                  <span className="w-6 text-center">{t.progress_percent === 100 ? <span className="text-green-600 font-bold">V</span> : <span className="text-slate-300">o</span>}</span>
                  <span className="w-10 font-mono text-slate-500 text-center">{t.wbs_code}</span>
                  <span className={`w-44 truncate pl-2 flex items-center gap-1 ${isSummary ? 'text-black' : 'text-slate-800'}`} style={{ paddingLeft: `${(t.indent_level || 0) * 12 + 8}px` }}>
                    {isSummary ? <Folder className="w-3 h-3 text-slate-400 shrink-0" /> : <FileText className="w-3 h-3 text-slate-400 shrink-0" />}
                    <span className="truncate">{t.name}</span>
                  </span>
                  
                  <div className="w-32 px-2 border-r border-slate-100 bg-slate-50/50">
                    {!isSummary && (
                      <div className="flex items-center gap-1.5 justify-end">
                        <input type="number" defaultValue={t.volume || 0} onBlur={(e) => handleLocalInlineUpdate(t.id, 'volume', Number(e.target.value))} className="w-16 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-right bg-transparent text-[11px] font-bold" onFocus={(e) => e.target.select()} />
                        <span className="text-[9px] text-slate-500 font-bold uppercase w-6">{t.satuan_hsd}</span>
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
                      <input type="text" key={`pred-${t.predecessors}`} defaultValue={t.predecessors || ''} placeholder="..." onBlur={(e) => handleLocalInlineUpdate(t.id, 'predecessors', e.target.value)} className="w-full border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-center bg-transparent text-[10px] font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-normal" />
                    ) : (
                      <div className="text-center text-slate-300 text-[10px]">-</div>
                    )}
                  </div>
                  
                  <span className="w-10 text-center font-bold text-slate-700 border-l border-slate-100">{Number(t.progress_percent || 0).toFixed(1)}%</span>
                  <span className="w-12 text-center font-bold text-indigo-700 border-l border-slate-100">{isSummary ? '-' : Number(t.smart_target || 0).toFixed(1) + '%'}</span>
                  <span className="w-12 text-center text-slate-600 font-semibold border-l border-slate-100">{isSummary ? '-' : Number(t.sisa_vol || 0).toFixed(2)}</span>
                  <span className="w-12 text-center text-indigo-600 font-bold border-l border-slate-100">{isSummary ? '-' : Number(t.butuh_t_hr || 0).toFixed(3)}</span>
                  
                  <span className={`w-14 text-center font-mono font-bold border-l border-slate-100 ${Number(t.varian_pct) < 0 ? 'text-red-600' : Number(t.varian_pct) > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                    {isSummary ? '-' : `${Number(t.varian_pct || 0) > 0 ? '+' : ''}${Number(t.varian_pct || 0).toFixed(1)}%`}
                  </span>
                  
                  <span className={`w-12 text-center font-mono font-bold border-l border-slate-100 ${Number(t.slack) < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {isSummary ? '-' : t.slack}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL KANAN (Timeline) */}
        <div ref={rightPanelRef} className="flex-1 overflow-auto relative bg-white select-none" onScroll={handleScroll}>
          <div className="relative" style={{ width: totalWidth, height: displayTasks.length * ROW_HEIGHT }}>
            
            <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
              {displayTasks.map((t, i) => (
                <div 
                  key={i} 
                  className={`w-full border-b border-slate-200 transition-colors ${hoveredTaskId === t.id ? 'bg-blue-50/60' : ''}`} 
                  style={{ height: ROW_HEIGHT }}
                ></div>
              ))}
            </div>

            <div className="absolute inset-0 flex pointer-events-none z-0">
              {calendarDays.map((cd, i) => {
                const isHoliday = exceptions.some(e => e.exception_date === cd.dateStr);
                let bgClass = isHoliday ? 'bg-red-50/50' : (zoomLevel === 'day' && cd.isWeekend) ? 'bg-slate-50' : '';
                let borderClass = (zoomLevel === 'week' && cd.date.getDay() === 1) ? 'border-r border-slate-300' : (zoomLevel === 'month' && cd.date.getDate() === 1) ? 'border-r border-slate-400' : 'border-r border-slate-100';
                return <div key={i} className={`${borderClass} h-full ${bgClass}`} style={{ width: pixelsPerDay }}></div>;
              })}
            </div>

            <div className="absolute top-0 bottom-0 border-l border-green-500 border-dashed z-10 pointer-events-none" style={{ left: getX(dataDate) }} title="Data Date"></div>
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
                const rawLeft = getX(t.early_start || t.start_date);
                const left = Math.max(0, rawLeft);
                
                let width = t.duration * pixelsPerDay;
                const startD = t.early_start || t.start_date;
                const endD = t.early_finish || t.end_date;

                if (startD && endD) {
                  const startX = getX(startD);
                  const endX = getX(endD);
                  if (endX >= startX) width = (endX - startX) + pixelsPerDay;
                }
                if (rawLeft < 0) width = width + rawLeft; 
                width = Math.max(8, width);
                
                const top = actualIndex * ROW_HEIGHT + 6; 
                const isHovered = hoveredTaskId === t.id;
                const isSummary = t.summary === 'Yes';
                const isCritical = t.is_critical;
                const progress = Number(t.progress_percent) || 0;

                if (t.duration === 0) return <div key={t.id} className="absolute pointer-events-auto flex items-center" style={{ left: left - 5, top: top + 2 }}><div className="w-3 h-3 bg-black rotate-45 shadow-sm z-30"></div></div>;
                if (isSummary) {
                  if (!startD || !endD) return null; 
                  return <div key={t.id} className="absolute pointer-events-auto" style={{ left, width, top: top + 2 }}><div className="absolute top-0 w-full h-[4px] bg-slate-800"></div><div className="absolute top-0 left-0 w-[4px] h-[10px] bg-slate-800" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 60%)' }}></div><div className="absolute top-0 right-0 w-[4px] h-[10px] bg-slate-800" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 0 100%)' }}></div></div>;
                }

                return (
                  <div 
                    key={t.id} 
                    onMouseEnter={() => setHoveredTaskId(t.id)} 
                    onMouseLeave={() => setHoveredTaskId(null)} 
                    className={`absolute group pointer-events-auto ${isHovered ? 'z-30 ring-2 ring-indigo-400' : ''}`} 
                    style={{ left, width, top }}
                  >
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

      <ResourceHistogram
        calendarDays={calendarDays}
        pixelsPerDay={pixelsPerDay}
        scrollLeft={scrollLeft}
        totalWidth={totalWidth}
        histogramData={histogramData}
        showHistogram={showHistogram}
        onToggle={() => setShowHistogram(v => !v)}
      />

    </div>
  );
}