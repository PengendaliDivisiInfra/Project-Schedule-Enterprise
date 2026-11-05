'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useProject } from '../../../context/ProjectContext';
import { updateProjectScheduleSecure, countWorkingDays } from '../../../lib/scheduler';
import { 
  Printer, ArrowLeft, Loader2, Settings, X, PieChart, Users, Package, Calendar 
} from 'lucide-react';

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const formatRp = (num) => 
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

const formatNum = (num) => 
  num ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num) : '-';

const formatDateShort = (d) => 
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';

// ==========================================
// SUB-COMPONENTS
// ==========================================

const EnterpriseGanttTable = ({ data, timescale, dateFrom, dateTo, isPrintMode = false }) => {
  if (!data || data.length === 0) return null;

  let filteredData = data;
  if (dateFrom || dateTo) {
    const filterStart = dateFrom ? new Date(dateFrom) : new Date(0);
    const filterEnd = dateTo ? new Date(dateTo) : new Date(8640000000000000);
    filteredData = data.filter(t => {
      if (!t.start_date || !t.end_date) return true;
      const s = new Date(t.start_date);
      const e = new Date(t.end_date);
      return (s <= filterEnd && e >= filterStart);
    });
  }

  if (filteredData.length === 0) {
    return <div className="text-center p-4 text-slate-500">Tidak ada data.</div>;
  }

  const allDates = filteredData
    .filter(t => t.start_date && t.end_date)
    .map(t => [new Date(t.start_date).getTime(), new Date(t.end_date).getTime()])
    .flat();

  let start = dateFrom ? new Date(dateFrom) : new Date(Math.min(...allDates));
  let end = dateTo ? new Date(dateTo) : new Date(Math.max(...allDates));

  const columns = [];
  if (timescale === 'Harian') {
    let curr = new Date(start);
    while (curr <= end) {
      columns.push({ 
        label: curr.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }), 
        start: new Date(curr), 
        end: new Date(curr) 
      });
      curr.setDate(curr.getDate() + 1);
    }
  } else if (timescale === 'Mingguan') {
    let curr = new Date(start);
    const day = curr.getDay() || 7; 
    if (day !== 1) curr.setHours(-24 * (day - 1));
    while (curr <= end) {
      const weekEnd = new Date(curr);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const weekNum = Math.ceil((((curr - new Date(curr.getFullYear(), 0, 1)) / 86400000) + 1) / 7);
      columns.push({ label: `W${weekNum}`, start: new Date(curr), end: weekEnd });
      curr.setDate(curr.getDate() + 7);
    }
  } else {
    let curr = new Date(start.getFullYear(), start.getMonth(), 1);
    while (curr <= end) {
      columns.push({ 
        label: curr.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }).toUpperCase(), 
        start: new Date(curr.getFullYear(), curr.getMonth(), 1), 
        end: new Date(curr.getFullYear(), curr.getMonth() + 1, 0, 23, 59, 59) 
      });
      curr.setMonth(curr.getMonth() + 1);
    }
  }

  const isActive = (task, colStart, colEnd) => {
    if (!task.start_date || !task.end_date) return false;
    const s = new Date(task.start_date); 
    const e = new Date(task.end_date);
    return (s <= colEnd && e >= colStart);
  };

  if (isPrintMode) {
    const getColIndex = (dateStr) => {
      if (!dateStr) return 0;
      const date = new Date(dateStr);
      let idx = columns.findIndex(c => date >= c.start && date <= c.end);
      if (idx === -1) idx = date < columns[0].start ? 0 : columns.length - 1;
      return idx;
    };

    const TARGET_PRINT_WIDTH = 1450; 
    const LEFT_COLUMNS_WIDTH = 40 + 200 + 55 + 55 + 40 + 60 + 60 + 45 + 50 + 55 + 55 + 60; 
    
    const availableTimelineWidth = TARGET_PRINT_WIDTH - LEFT_COLUMNS_WIDTH;
    let COL_WIDTH = availableTimelineWidth / columns.length;
    if (COL_WIDTH < 24) COL_WIDTH = 24; 
    
    const TABLE_WIDTH = LEFT_COLUMNS_WIDTH + (columns.length * COL_WIDTH);
    const ROW_HEIGHT = 22; 

    return (
      <div className="gantt-print-wrapper" style={{ position: 'relative', width: `${TABLE_WIDTH}px`, minWidth: '100%' }}>
        <table className="gantt-table" style={{ width: `${TABLE_WIDTH}px`, minWidth: '100%' }}>
          <colgroup>
            <col style={{ width: '40px' }} />
            <col style={{ width: '200px' }} />
            <col style={{ width: '55px' }} />
            <col style={{ width: '55px' }} />
            <col style={{ width: '40px' }} />
            <col style={{ width: '60px' }} />
            <col style={{ width: '60px' }} />
            <col style={{ width: '45px' }} />
            <col style={{ width: '50px' }} />
            <col style={{ width: '55px' }} />
            <col style={{ width: '55px' }} />
            <col style={{ width: '60px' }} />
            {columns.map((_, i) => <col key={i} style={{ width: `${COL_WIDTH}px` }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="text-center">WBS</th>
              <th className="text-center">URAIAN</th>
              <th className="text-center">VOL</th>
              <th className="text-center">SISA</th>
              <th className="text-center">DUR</th>
              <th className="text-center">MULAI</th>
              <th className="text-center">SELESAI</th>
              <th className="text-center">PRED</th>
              <th className="text-center">BOBOT</th>
              <th className="text-center">RENCANA</th>
              <th className="text-center">VARIAN</th>
              <th className="text-center">T/HR</th>
              {columns.map((m, i) => (
                <th key={i} className="timeline-header">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((t, i) => {
              const isSummary = t.summary !== 'No';
              const isCritical = t.is_critical || t.varian_pct < -10;

              const startColIdx = getColIndex(t.start_date);
              const endColIdx = getColIndex(t.end_date);
              const span = Math.max(1, endColIdx - startColIdx + 1);

              return (
                <tr key={i} style={{ height: `${ROW_HEIGHT}px` }}>
                  <td className="text-center">{t.wbs_code}</td>
                  <td className={`text-left ${isSummary ? 'font-bold' : ''}`}>{t.name}</td>
                  <td className="text-right">{formatNum(t.volume)}</td>
                  <td className="text-right">{formatNum(t.sisa_vol)}</td>
                  <td className="text-center">{t.duration}d</td>
                  <td className="text-center">{formatDateShort(t.start_date)}</td>
                  <td className="text-center">{formatDateShort(t.end_date)}</td>
                  <td className="text-center">{t.predecessors || '-'}</td>
                  <td className="text-right">{Number(t.progress_percent || 0).toFixed(1)}%</td>
                  <td className="text-right">{t.smart_target ? t.smart_target.toFixed(1) : 0}%</td>
                  <td className="text-right">{t.varian_pct > 0 ? '+' : ''}{t.varian_pct ? t.varian_pct.toFixed(1) : 0}%</td>
                  <td className="text-right">{t.butuh_t_hr ? t.butuh_t_hr.toFixed(2) : '-'}</td>
                  
                  {Array.from({ length: startColIdx }).map((_, idx) => (
                    <td key={`empty-start-${idx}`} className="empty-cell"></td>
                  ))}

                  <td colSpan={span} className="bar-cell">
                    <div className="gantt-bar-container">
                      {isSummary ? (
                        <div className="gantt-bar-summary"></div>
                      ) : (
                        <div className={`gantt-bar-${isCritical ? 'red' : 'blue'}`}></div>
                      )}
                    </div>
                  </td>

                  {Array.from({ length: columns.length - (startColIdx + span) }).map((_, idx) => (
                    <td key={`empty-end-${idx}`} className="empty-cell"></td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left border-collapse text-[10px] min-w-[1000px]">
        <thead className="bg-slate-800 text-white uppercase tracking-wider">
          <tr>
            <th className="p-2 border border-slate-700 text-center w-12">WBS</th>
            <th className="p-2 border border-slate-700 min-w-[200px]">URAIAN</th>
            <th className="p-2 border border-slate-700 text-right">VOL</th>
            <th className="p-2 border border-slate-700 text-right">SISA</th>
            <th className="p-2 border border-slate-700 text-center">DUR</th>
            <th className="p-2 border border-slate-700 text-center">MULAI</th>
            <th className="p-2 border border-slate-700 text-center">SELESAI</th>
            <th className="p-2 border border-slate-700 text-right">RENCANA</th>
            <th className="p-2 border border-slate-700 text-right">VARIAN</th>
            <th className="p-2 border border-slate-700 text-right">T/HR</th>
            {columns.map((m, i) => (
              <th key={i} className="p-2 border border-slate-700 text-center text-[9px] min-w-[40px]">{m.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.map((t, i) => {
            const isSummary = t.summary !== 'No';
            const isCritical = t.is_critical || t.varian_pct < -10;
            return (
              <tr key={i} className={`${isSummary ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'}`}>
                <td className="p-1.5 border border-slate-300 text-center font-mono">{t.wbs_code}</td>
                <td className="p-1.5 border border-slate-300 truncate max-w-[200px]">{t.name}</td>
                <td className="p-1.5 border border-slate-300 text-right">{formatNum(t.volume)}</td>
                <td className="p-1.5 border border-slate-300 text-right">{formatNum(t.sisa_vol)}</td>
                <td className="p-1.5 border border-slate-300 text-center">{t.duration}d</td>
                <td className="p-1.5 border border-slate-300 text-center whitespace-nowrap">{formatDateShort(t.start_date)}</td>
                <td className="p-1.5 border border-slate-300 text-center whitespace-nowrap">{formatDateShort(t.end_date)}</td>
                <td className="p-1.5 border border-slate-300 text-right">{t.smart_target ? t.smart_target.toFixed(1) : 0}%</td>
                <td className="p-1.5 border border-slate-300 text-right">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    t.varian_pct < -10 ? 'bg-red-100 text-red-700' : 
                    t.varian_pct < -5 ? 'bg-amber-100 text-amber-700' : 
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {t.varian_pct > 0 ? '+' : ''}{t.varian_pct ? t.varian_pct.toFixed(1) : 0}%
                  </span>
                </td>
                <td className="p-1.5 border border-slate-300 text-right">{t.butuh_t_hr ? t.butuh_t_hr.toFixed(2) : '-'}</td>
                {columns.map((m, ci) => {
                  const active = isActive(t, m.start, m.end);
                  let bgClass = '';
                  if (active) {
                    if (isSummary) bgClass = 'bg-slate-800';
                    else if (isCritical) bgClass = 'bg-red-500';
                    else bgClass = 'bg-blue-600';
                  }
                  return <td key={ci} className={`p-0 border border-slate-300 h-6 ${bgClass}`}></td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function MasterReportPage() {
  const { activeProjectId } = useProject();
  
  const [loading, setLoading] = useState(true);
  const [projectInfo, setProjectInfo] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [resources, setResources] = useState([]);
  const [materials, setMaterials] = useState([]);
  
  const [workingDays, setWorkingDays] = useState([1,2,3,4,5]);
  const [exceptions, setExceptions] = useState([]);

  const [activeTab, setActiveTab] = useState('gantt');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isGeneratingPrint, setIsGeneratingPrint] = useState(false);
  
  const [watermarkText, setWatermarkText] = useState('DRAFT'); 

  const [printConfig, setPrintConfig] = useState({
    timescale: 'Bulanan', 
    dateFrom: '', 
    dateTo: '',
    showSignatures: true, 
    showLegend: true,
    dibuatNama: 'Budi Santoso, ST', 
    dibuatJabatan: 'Site Engineer', 
    dibuatInstansi: 'PT. Kontraktor Pelaksana',
    diperiksaNama: 'Andi Wijaya, ST', 
    diperiksaJabatan: 'Team Leader', 
    diperiksaInstansi: 'PT. Konsultan Supervisi',
    disetujuiNama: 'Ir. Hendra Kusuma, MT', 
    disetujuiJabatan: 'PPK / Direksi', 
    disetujuiInstansi: 'Kementerian PUPR', 
    disetujuiNip: '19800000 200500 1 000'
  });

  const recalculateRollupDates = (tasks) => {
    let tasksCopy = JSON.parse(JSON.stringify(tasks));
    tasksCopy.sort((a, b) => (b.wbs_code || '').length - (a.wbs_code || '').length);
    
    tasksCopy.forEach(parent => {
      if (parent.summary !== 'No') {
        const prefix = parent.wbs_code + '.';
        const directChildren = tasksCopy.filter(child => 
          child.wbs_code.startsWith(prefix) && 
          child.wbs_code.split('.').length === parent.wbs_code.split('.').length + 1
        );
        if (directChildren.length > 0) {
          const validStarts = directChildren.map(c => new Date(c.start_date).getTime()).filter(t => !isNaN(t));
          const validEnds = directChildren.map(c => new Date(c.end_date).getTime()).filter(t => !isNaN(t));
          
          if (validStarts.length > 0 && validEnds.length > 0) {
            parent.start_date = new Date(Math.min(...validStarts)).toISOString();
            parent.end_date = new Date(Math.max(...validEnds)).toISOString();
            const diffTime = Math.abs(new Date(parent.end_date) - new Date(parent.start_date));
            parent.duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }
        }
      }
    });
    return tasksCopy.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));
  };

  const calculateEVM = (data, cwd, cex) => {
    const today = new Date(); 
    today.setHours(0,0,0,0);
    
    return data.map(t => {
      const vol = Number(t.volume) || 0; 
      const progPct = Number(t.progress_percent) || 0;
      const startDate = t.start_date ? new Date(t.start_date) : null;
      const endDate = t.end_date ? new Date(t.end_date) : null;
      let smartTargetPct = 0; 
      let sisaHari = t.duration || 1;
      
      if (t.summary === 'No' && startDate && endDate) {
        if (today >= endDate) { 
          smartTargetPct = 100; 
          sisaHari = 0; 
        } else if (today > startDate) {
          const totalWorkingDays = countWorkingDays(startDate, endDate, cwd, cex) || 1;
          const elapsedWorkingDays = countWorkingDays(startDate, today, cwd, cex);
          
          smartTargetPct = Math.min(100, Math.max(0, (elapsedWorkingDays / totalWorkingDays) * 100));
          sisaHari = Math.max(0, totalWorkingDays - elapsedWorkingDays); 
        } else {
          sisaHari = countWorkingDays(startDate, endDate, cwd, cex);
        }
      }
      
      const actualVol = vol * (progPct / 100);
      const sisaVol = vol - actualVol;
      const varianPct = progPct - smartTargetPct;
      const butuhTHr = sisaHari > 0 ? (sisaVol / sisaHari) : 0;
      
      return { 
        ...t, 
        smart_target: smartTargetPct, 
        actual_vol: actualVol, 
        sisa_vol: sisaVol, 
        varian_pct: varianPct, 
        butuh_t_hr: butuhTHr 
      };
    });
  };

  // 🟢 FUNGSI BARU: Menghitung ulang Resource & Material berdasarkan Sisa Volume
  const processDynamicPlans = (rawResources, rawMaterials, tasks) => {
    const dynamicResources = rawResources.map(res => {
      const task = tasks.find(t => t.wbs_code === res.wbs_code);
      if (task && task.volume > 0) {
        const proporsiSisa = task.sisa_vol / task.volume; 
        const sisaTotalKebutuhan = res.total_kebutuhan * proporsiSisa; 
        
        let sisaHariAktual = 1;
        if (task.end_date) {
          const sisaHariMs = new Date(task.end_date) - new Date();
          sisaHariAktual = Math.max(1, Math.ceil(sisaHariMs / (1000 * 60 * 60 * 24))); 
        }

        const butuhPerHariDinamis = sisaTotalKebutuhan / sisaHariAktual;

        return {
          ...res,
          total_kebutuhan: sisaTotalKebutuhan,
          kebutuhan_harian: butuhPerHariDinamis,
          is_delayed: new Date(task.end_date) < new Date()
        };
      }
      return res;
    });

    const dynamicMaterials = rawMaterials.map(mat => {
      const task = tasks.find(t => t.wbs_code === mat.wbs_code);
      if (task && task.volume > 0) {
        const proporsiSisa = task.sisa_vol / task.volume;
        const sisaTotalDibeli = mat.total_dibeli * proporsiSisa;
        
        const hargaSatuan = mat.total_dibeli > 0 ? (mat.estimasi_biaya / mat.total_dibeli) : 0;
        const sisaEstimasiBiaya = sisaTotalDibeli * hargaSatuan;

        return {
          ...mat,
          total_dibeli: sisaTotalDibeli,
          estimasi_biaya: sisaEstimasiBiaya
        };
      }
      return mat;
    });

    return { dynamicResources, dynamicMaterials };
  };

  const fetchData = async (isBackground = false) => {
    if (!activeProjectId) { 
      setLoading(false); 
      return; 
    }
    
    if (!isBackground) setLoading(true);

    try {
      const [projRes, taskRes, resRes, matRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', activeProjectId).maybeSingle(),
        supabase.from('wbs_tasks').select('*').eq('project_id', activeProjectId).order('wbs_code'),
        supabase.from('v_resource_plan').select('*').eq('project_id', activeProjectId).order('wbs_code'),
        supabase.from('v_material_plan').select('*').eq('project_id', activeProjectId).order('wbs_code')
      ]);
      
      let cwd = [1,2,3,4,5];
      let cex = [];
      
      if (projRes.data) {
        setProjectInfo(projRes.data);
        if (projRes.data.working_days && Array.isArray(projRes.data.working_days) && projRes.data.working_days.length > 0) {
          cwd = projRes.data.working_days.map(Number);
          setWorkingDays(cwd);
        }
        if (projRes.data.exceptions) {
          cex = projRes.data.exceptions;
          setExceptions(cex);
        }
      }
      
      let processedTasks = [];
      if (taskRes.data) {
        const engineResult = updateProjectScheduleSecure(taskRes.data, cwd, cex);
        let finalTasks = taskRes.data;
        
        if (engineResult.success) {
          finalTasks = engineResult.tasks;
        }

        const fixedTasks = recalculateRollupDates(finalTasks);
        processedTasks = calculateEVM(fixedTasks, cwd, cex);
        setAllTasks(processedTasks);
      }

      // 🟢 TERAPKAN KALKULASI DINAMIS
      if (resRes.data && matRes.data) {
        const { dynamicResources, dynamicMaterials } = processDynamicPlans(resRes.data, matRes.data, processedTasks);
        setResources(dynamicResources);
        setMaterials(dynamicMaterials);
      } else {
        if (resRes.data) setResources(resRes.data);
        if (matRes.data) setMaterials(matRes.data);
      }

    } catch (err) { 
      console.error("Fetch Data Error:", err); 
    } finally { 
      if (!isBackground) setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData(); 
    
    if (!activeProjectId) return;

    const channel = supabase
      .channel(`reports_realtime_${activeProjectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wbs_tasks' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_flows' }, () => fetchData(true))
      .subscribe();
      
    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [activeProjectId]);

  const totalBAC = allTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);
  const actualProgressCost = allTasks.reduce((sum, t) => sum + ((Number(t.cost) || 0) * (Number(t.progress_percent) || 0) / 100), 0);
  const plannedProgressCost = allTasks.reduce((sum, t) => sum + ((Number(t.cost) || 0) * (Number(t.smart_target) || 0) / 100), 0);
  
  const actualPct = totalBAC > 0 ? (actualProgressCost / totalBAC) * 100 : 0;
  const plannedPct = totalBAC > 0 ? (plannedProgressCost / totalBAC) * 100 : 0;
  const varianPct = actualPct - plannedPct;

  const handlePrint = async () => {
    setIsPrintModalOpen(false);
    setIsGeneratingPrint(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 300)); 

      const printContent = document.getElementById('print-section');
      if (!printContent) return;

      const allDates = allTasks.filter(t => t.start_date && t.end_date).map(t => [new Date(t.start_date).getTime(), new Date(t.end_date).getTime()]).flat();
      let start = printConfig.dateFrom ? new Date(printConfig.dateFrom) : new Date(Math.min(...allDates));
      let end = printConfig.dateTo ? new Date(printConfig.dateTo) : new Date(Math.max(...allDates));
      
      let estimatedColumns = 12;
      if (printConfig.timescale === 'Harian') {
        estimatedColumns = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      } else if (printConfig.timescale === 'Mingguan') {
        estimatedColumns = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 7)) + 1;
      } else {
        estimatedColumns = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      }

      const LEFT_COLUMNS_WIDTH = 775; 
      const TARGET_PRINT_WIDTH = 1450;
      const availableTimelineWidth = TARGET_PRINT_WIDTH - LEFT_COLUMNS_WIDTH;
      let dynamicColWidth = availableTimelineWidth / estimatedColumns;
      if (dynamicColWidth < 24) dynamicColWidth = 24;
      
      const actualTableWidth = LEFT_COLUMNS_WIDTH + (estimatedColumns * dynamicColWidth);
      
      let pdfScale = 1;
      if (actualTableWidth > 1550) {
        pdfScale = 1550 / actualTableWidth; 
      }
      if (pdfScale < 0.5) pdfScale = 0.5; 

      const pdfStyles = `
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            margin: 0; padding: 0; 
            -webkit-print-color-adjust: exact; print-color-adjust: exact; 
            color: #1e293b; line-height: 1.2; 
            width: 100%;
          }

          body::before {
            content: "${watermarkText}"; 
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 150px;
            font-weight: 900;
            color: rgba(0, 0, 0, 0.05); 
            z-index: -1;
            pointer-events: none;
            white-space: nowrap;
            font-family: 'Segoe UI', Arial, sans-serif;
            letter-spacing: 10px;
          }
          
          @page gantt_layout { 
            size: A3 landscape; 
            margin: 10mm 10mm 15mm 10mm; 
          }
          @page matrix_layout { 
            size: A3 landscape; 
            margin: 10mm 10mm 15mm 10mm; 
          }
          
          .print-page-gantt { page: gantt_layout; break-before: page; width: 100%; }
          .print-page-matrix { page: matrix_layout; break-before: page; width: 100%; }
          
          .header { 
            position: relative; 
            border-bottom: 2px solid #e2e8f0; 
            padding-bottom: 6px; 
            margin-bottom: 12px; 
            display: flex; 
            align-items: center;
            gap: 15px;
          }
          h1 { font-size: 18px; font-weight: 700; margin: 0 0 2px 0; text-transform: uppercase; color: #0f172a; }
          h2 { font-size: 13px; font-weight: 600; color: #4338ca; margin: 0 0 8px 0; text-transform: uppercase; }
          .rev-box { position: absolute; top: 0; right: 0; border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 9px; font-weight: 700; color: #475569; background-color: #f8fafc; border-radius: 4px; }
          .header-meta { display: flex; gap: 15px; font-size: 10px; color: #475569; margin-top: 4px; font-weight: 500; }
          
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; width: 100%; }
          .kpi-card { padding: 12px 16px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: center; }
          .kpi-card.primary { background-color: #eff6ff; border-left: 4px solid #3b82f6; }
          .kpi-card.success { background-color: #ecfdf5; border-left: 4px solid #10b981; }
          .kpi-card.danger { background-color: #fef2f2; border-left: 4px solid #ef4444; }
          .kpi-label { font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; margin: 0 0 6px 0; }
          .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1; }
          
          table { border-collapse: collapse; margin-bottom: 12px; font-size: 11px; table-layout: fixed; width: 100%; break-inside: auto; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; }
          th { background-color: #1e3a8a !important; color: #fff !important; text-align: center !important; vertical-align: middle !important; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          thead { display: table-header-group !important; }
          
          .text-left { text-align: left !important; padding-left: 8px !important; }
          .text-center { text-align: center !important; white-space: nowrap; }
          .text-right { 
            text-align: right !important; 
            padding-right: 8px !important; 
            font-variant-numeric: tabular-nums; 
            white-space: nowrap !important;
            overflow: hidden;
          } 
          
          .gantt-print-wrapper { position: relative; margin: 0; }
          .gantt-table { table-layout: fixed !important; border: 1px solid #94a3b8; font-size: 9px; }
          .gantt-table th, .gantt-table td { padding: 2px 4px; }
          .gantt-table th.timeline-header { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; height: 40px; padding: 2px 0; font-size: 8px; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; }
          .gantt-table td.bar-cell { padding: 0 2px !important; border-left: none !important; border-right: none !important; position: relative; }
          .gantt-table td.empty-cell { padding: 0 !important; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; }
          
          .gantt-bar-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; z-index: 10; }
          
          .gantt-bar-blue { 
            background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%) !important; 
            border: 1px solid #2563eb; 
            height: 10px; 
            width: 100%; 
            border-radius: 999px; 
            box-shadow: 0 1px 2px rgba(0,0,0,0.15); 
          }
          
          .gantt-bar-red { 
            background: linear-gradient(180deg, #f87171 0%, #ef4444 100%) !important; 
            border: 1px solid #dc2626; 
            height: 10px; 
            width: 100%; 
            border-radius: 999px; 
            box-shadow: 0 1px 2px rgba(0,0,0,0.15); 
          }
          
          .gantt-bar-summary {
            background: linear-gradient(180deg, #334155 0%, #0f172a 100%) !important; 
            height: 6px; 
            width: 100%; 
            position: relative;
            border-radius: 2px;
            box-shadow: 0 1px 1px rgba(0,0,0,0.2);
          }
          .gantt-bar-summary::before, .gantt-bar-summary::after {
            content: '';
            position: absolute;
            top: 5px; 
            border-left: 4px solid transparent; 
            border-right: 4px solid transparent;
            border-top: 5px solid #0f172a;
          }
          .gantt-bar-summary::before { left: 0; }
          .gantt-bar-summary::after { right: 0; }

          .legend { display: flex; justify-content: flex-end; gap: 12px; font-size: 10px; font-weight: 600; margin-top: 15px; color: #475569; }
          .legend-box { display: inline-block; width: 12px; height: 12px; margin-right: 6px; border-radius: 2px; }
          
          .signature-wrapper { margin-top: 40px; page-break-inside: avoid !important; display: flex; justify-content: space-between; text-align: center; width: 100%; }
          .signature-box { flex: 1; display: flex; flex-direction: column; align-items: center; }
          .signature-title { font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 4px; }
          .signature-company { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 50px; }
          .signature-name-wrapper { display: inline-block; border-bottom: 1.5px solid #0f172a; padding-bottom: 2px; padding-left: 15px; padding-right: 15px; margin-bottom: 4px; }
          .signature-name { font-size: 12px; font-weight: 700; color: #0f172a; }
          .signature-nip { font-size: 10px; color: #475569; font-weight: 500; margin-bottom: 2px; }
          .signature-role { font-size: 11px; color: #64748b; }
        </style>
      `;

      const htmlString = `
        <!DOCTYPE html>
        <html>
          <head><title>PMP Report</title>${pdfStyles}</head>
          <body>${printContent.innerHTML}</body>
        </html>
      `;

      const response = await fetch('https://pdf-service-repo-production.up.railway.app/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlString, scale: pdfScale })
      });

      if (!response.ok) throw new Error('Server gagal mencetak PDF. Cek terminal.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Master_Report_${projectInfo?.name || 'Project'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsGeneratingPrint(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!activeProjectId) {
    return <div className="p-10 text-center font-bold">Pilih proyek terlebih dahulu.</div>;
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      
      {isGeneratingPrint && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm print:hidden">
          <Loader2 className="animate-spin text-white mb-4" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Menyiapkan Dokumen PDF...</h2>
          <p className="text-slate-300 text-sm">Server sedang merender laporan.</p>
        </div>
      )}

      {/* HEADER UI */}
      <div className="max-w-[1400px] mx-auto mb-6 print:hidden">
        <button onClick={() => window.history.back()} className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-2 mb-4">
          <ArrowLeft size={16}/> Kembali ke Dashboard
        </button>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Executive Report Preview</h1>
            <p className="text-sm text-slate-500 mt-1">Data laporan terupdate secara Real-time.</p>
          </div>
          <button 
            onClick={() => setIsPrintModalOpen(true)} 
            disabled={isGeneratingPrint}
            className={`bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 hover:bg-indigo-700 transition-all ${isGeneratingPrint ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Printer size={18}/> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto print:hidden">
        {/* KOP SURAT & KPI */}
        <div className="bg-white p-8 rounded-t-xl border border-slate-200 border-b-0">
          <div className="flex justify-between items-start border-b-4 border-slate-800 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 uppercase tracking-wide">PROJECT MASTER PROGRAM (PMP)</h1>
              <h2 className="text-lg font-bold text-indigo-700 mt-1 uppercase">{projectInfo?.name}</h2>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 bg-white text-xs">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="font-bold text-slate-500 mb-1 uppercase">Nilai Kontrak</p>
              <p className="text-2xl font-extrabold text-slate-900">{formatRp(projectInfo?.contract_value)}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-bold text-blue-600 mb-1 uppercase">Target Rencana (%)</p>
              <p className="text-2xl font-extrabold text-blue-900">{plannedPct.toFixed(2)}%</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="font-bold text-emerald-600 mb-1 uppercase">Aktual Realisasi (%)</p>
              <p className="text-2xl font-extrabold text-emerald-900">{actualPct.toFixed(2)}%</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="font-bold text-red-600 mb-1 uppercase">Status Varian</p>
              <p className={`text-2xl font-extrabold ${varianPct < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {varianPct > 0 ? '+' : ''}{varianPct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="bg-white border-x border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="flex border-b border-slate-200 px-6 pt-2 overflow-x-auto">
            {[
              { id: 'gantt', label: 'Time Schedule', icon: Calendar },
              { id: 'evm', label: 'EVM Matrix', icon: PieChart },
              { id: 'resource', label: 'Resource Plan', icon: Users },
              { id: 'material', label: 'Material Plan', icon: Package }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)} 
                className={`px-6 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon size={16}/> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="bg-white p-8 border border-slate-200 border-t-0 rounded-b-xl mb-8 shadow-sm">
          {activeTab === 'gantt' && (
            <EnterpriseGanttTable data={allTasks} timescale="Bulanan" dateFrom="" dateTo="" />
          )}
          
          {activeTab === 'evm' && (
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
                <thead className="sticky top-0 z-10 bg-slate-800 shadow-md">
                  <tr className="bg-slate-800 text-white uppercase tracking-wider">
                    <th className="p-1 border border-slate-700 text-center">WBS</th>
                    <th className="p-1 border border-slate-700">URAIAN</th>
                    <th className="p-1 border border-slate-700 text-right">Vol Total</th>
                    <th className="p-1 border border-slate-700 text-center">Dur</th>
                    <th className="p-1 border border-slate-700 text-center">Mulai</th>
                    <th className="p-1 border border-slate-700 text-center">Selesai</th>
                    <th className="p-1 border border-slate-700 text-right">Vol Realisasi</th>
                    <th className="p-1 border border-slate-700 text-right">Sisa</th>
                    <th className="p-1 border border-slate-700 text-right">Rencana</th>
                    <th className="p-1 border border-slate-700 text-right">Aktual</th>
                    <th className="p-1 border border-slate-700 text-right">Varian</th>
                  </tr>
                </thead>
                <tbody>
                  {allTasks.map((t, i) => (
                    <tr key={i} className={`${t.summary !== 'No' ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'}`}>
                      <td className="p-1 border border-slate-300 font-mono text-center">{t.wbs_code}</td>
                      <td className="p-1 border border-slate-300 truncate max-w-[150px]">{t.name}</td>
                      <td className="p-1 border border-slate-300 text-right">{formatNum(t.volume)}</td>
                      <td className="p-1 border border-slate-300 text-center">{t.duration}d</td>
                      <td className="p-1 border border-slate-300 text-center whitespace-nowrap">{formatDateShort(t.start_date)}</td>
                      <td className="p-1 border border-slate-300 text-center whitespace-nowrap">{formatDateShort(t.end_date)}</td>
                      <td className="p-1 border border-slate-300 text-right">{formatNum(t.actual_vol)}</td>
                      <td className="p-1 border border-slate-300 text-right">{formatNum(t.sisa_vol)}</td>
                      <td className="p-1 border border-slate-300 text-right">{t.smart_target ? t.smart_target.toFixed(1) : 0}%</td>
                      <td className="p-1 border border-slate-300 text-right font-bold">{Number(t.progress_percent || 0).toFixed(1)}%</td>
                      <td className="p-1 border border-slate-300 text-right">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                          t.varian_pct < -10 ? 'bg-red-100 text-red-700' : 
                          t.varian_pct < -5 ? 'bg-amber-100 text-amber-700' : 
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {t.varian_pct > 0 ? '+' : ''}{t.varian_pct ? t.varian_pct.toFixed(1) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'resource' && (
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
                <thead className="sticky top-0 z-10 bg-slate-800 shadow-md">
                  <tr className="bg-slate-800 text-white uppercase tracking-wider">
                    <th className="p-1 border border-slate-700 text-center">WBS</th>
                    <th className="p-1 border border-slate-700">URAIAN</th>
                    <th className="p-1 border border-slate-700">Resource / Crew</th>
                    <th className="p-1 border border-slate-700 text-right">Sisa TR (Jam)</th>
                    <th className="p-1 border border-slate-700 text-right">Butuh TR / Hari</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-1 border border-slate-300 font-mono text-center">{r.wbs_code}</td>
                      <td className="p-1 border border-slate-300 truncate max-w-[150px]">{r.task_name}</td>
                      <td className="p-1 border border-slate-300 truncate max-w-[200px]">{r.resource_crew}</td>
                      <td className="p-1 border border-slate-300 text-right font-bold text-indigo-700">{formatNum(r.total_kebutuhan)} Jam</td>
                      <td className={`p-1 border border-slate-300 text-right font-bold ${r.is_delayed ? 'text-red-600' : 'text-emerald-700'}`}>
                        {formatNum(r.kebutuhan_harian)} Jam
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'material' && (
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
                <thead className="sticky top-0 z-10 bg-slate-800 shadow-md">
                  <tr className="bg-slate-800 text-white uppercase tracking-wider">
                    <th className="p-1 border border-slate-700 text-center">WBS</th>
                    <th className="p-1 border border-slate-700">URAIAN</th>
                    <th className="p-1 border border-slate-700">Material</th>
                    <th className="p-1 border border-slate-700 text-right">Sisa Dibutuhkan</th>
                    <th className="p-1 border border-slate-700 text-right">Estimasi Sisa Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-1 border border-slate-300 font-mono text-center">{m.wbs_code}</td>
                      <td className="p-1 border border-slate-300 truncate max-w-[150px]">{m.task_name}</td>
                      <td className="p-1 border border-slate-300 truncate max-w-[200px]">{m.material_name}</td>
                      <td className="p-1 border border-slate-300 text-right font-bold text-blue-700">{formatNum(m.total_dibeli)}</td>
                      <td className="p-1 border border-slate-300 text-right font-bold whitespace-nowrap">{formatRp(m.estimasi_biaya)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PRINT AREA */}
      {/* ===================================================================== */}
      <div id="print-section" className="hidden">
        
        {/* HALAMAN 1: TIME SCHEDULE */}
        <div className="print-page-gantt">
          <div className="header">
            {projectInfo?.logo_url ? (
              <img src={projectInfo.logo_url} alt="Logo Proyek" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
            ) : (
              <div style={{ height: '60px', width: '60px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '4px' }}>LOGO</div>
            )}
            <div>
              <div className="rev-box">REV: 01 | {new Date().toLocaleDateString('id-ID')}</div>
              <h1>PROJECT MASTER PROGRAM (PMP) - TIME SCHEDULE</h1>
              <h2>{projectInfo?.name || '-'}</h2>
              <div className="header-meta">
                <span>No. Kontrak: {projectInfo?.contract_number || '-'}</span>
                <span>Lokasi: {projectInfo?.location || '-'}</span>
              </div>
            </div>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card primary">
              <p className="kpi-label">Nilai Kontrak</p>
              <p className="kpi-value">{formatRp(projectInfo?.contract_value)}</p>
            </div>
            <div className="kpi-card primary">
              <p className="kpi-label" style={{ color: '#1d4ed8' }}>Target Rencana (%)</p>
              <p className="kpi-value" style={{ color: '#1e3a8a' }}>{plannedPct.toFixed(2)}%</p>
            </div>
            <div className="kpi-card success">
              <p className="kpi-label" style={{ color: '#047857' }}>Aktual Realisasi (%)</p>
              <p className="kpi-value" style={{ color: '#064e3b' }}>{actualPct.toFixed(2)}%</p>
            </div>
            <div className={`kpi-card ${varianPct < 0 ? 'danger' : 'success'}`}>
              <p className="kpi-label" style={{ color: varianPct < 0 ? '#b91c1c' : '#047857' }}>Status Varian</p>
              <p className="kpi-value" style={{ color: varianPct < 0 ? '#7f1d1d' : '#064e3b' }}>{varianPct > 0 ? '+' : ''}{varianPct.toFixed(2)}%</p>
            </div>
          </div>

          <EnterpriseGanttTable 
            data={allTasks} 
            timescale={printConfig.timescale} 
            dateFrom={printConfig.dateFrom} 
            dateTo={printConfig.dateTo} 
            isPrintMode={true} 
          />

          {printConfig.showLegend && (
            <div className="legend">
              <span><span className="legend-box" style={{ backgroundColor: '#3b82f6' }}></span> Normal</span>
              <span><span className="legend-box" style={{ backgroundColor: '#ef4444' }}></span> Kritis</span>
              <span><span className="legend-box" style={{ backgroundColor: '#0f172a' }}></span> Summary</span>
            </div>
          )}
        </div>

        {/* HALAMAN 2: EVM MATRIX */}
        <div className="print-page-matrix">
          <div className="header">
            {/* 🟢 PERBAIKAN: Tambahkan Logo di Header Halaman 2 */}
            {projectInfo?.logo_url ? (
              <img src={projectInfo.logo_url} alt="Logo Proyek" style={{ height: '50px', width: 'auto', objectFit: 'contain' }} />
            ) : (
              <div style={{ height: '50px', width: '50px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '4px' }}>LOGO</div>
            )}
            <div>
              <div className="rev-box">REV: 01 | {new Date().toLocaleDateString('id-ID')}</div>
              <h1>PROJECT MASTER PROGRAM (PMP) - EVM MATRIX</h1>
              <h2>{projectInfo?.name || '-'}</h2>
              <div className="header-meta">
                <span>No. Kontrak: {projectInfo?.contract_number || '-'}</span>
                <span>Lokasi: {projectInfo?.location || '-'}</span>
              </div>
            </div>
          </div>
          <table style={{ width: '100%' }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-center">WBS</th>
                <th className="text-center">URAIAN</th>
                <th className="text-center">VOL TOTAL</th>
                <th className="text-center">DUR</th>
                <th className="text-center">MULAI</th>
                <th className="text-center">SELESAI</th>
                <th className="text-center">VOL REALISASI</th>
                <th className="text-center">SISA</th>
                <th className="text-center">RENCANA</th>
                <th className="text-center">AKTUAL</th>
                <th className="text-center">VARIAN</th>
              </tr>
            </thead>
            <tbody>
              {allTasks.map((t, i) => (
                <tr key={i} style={{ backgroundColor: t.summary !== 'No' ? '#f8fafc' : 'transparent' }}>
                  <td className="text-center">{t.wbs_code}</td>
                  <td className="text-left">{t.name}</td>
                  <td className="text-right">{formatNum(t.volume)}</td>
                  <td className="text-center">{t.duration}d</td>
                  <td className="text-center">{formatDateShort(t.start_date)}</td>
                  <td className="text-center">{formatDateShort(t.end_date)}</td>
                  <td className="text-right">{formatNum(t.actual_vol)}</td>
                  <td className="text-right">{formatNum(t.sisa_vol)}</td>
                  <td className="text-right">{t.smart_target ? t.smart_target.toFixed(1) : 0}%</td>
                  <td className="text-right font-bold">{Number(t.progress_percent || 0).toFixed(1)}%</td>
                  <td className="text-right font-bold">{t.varian_pct > 0 ? '+' : ''}{t.varian_pct ? t.varian_pct.toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* HALAMAN 3: RESOURCES */}
        <div className="print-page-matrix">
          <div className="header">
            {/* 🟢 PERBAIKAN: Tambahkan Logo di Header Halaman 3 */}
            {projectInfo?.logo_url ? (
              <img src={projectInfo.logo_url} alt="Logo Proyek" style={{ height: '50px', width: 'auto', objectFit: 'contain' }} />
            ) : (
              <div style={{ height: '50px', width: '50px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '4px' }}>LOGO</div>
            )}
            <div>
              <div className="rev-box">REV: 01 | {new Date().toLocaleDateString('id-ID')}</div>
              <h1>PROJECT MASTER PROGRAM (PMP) - RESOURCES</h1>
              <h2>{projectInfo?.name || '-'}</h2>
              <div className="header-meta">
                <span>No. Kontrak: {projectInfo?.contract_number || '-'}</span>
                <span>Lokasi: {projectInfo?.location || '-'}</span>
              </div>
            </div>
          </div>
          <table style={{ width: '100%' }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-center">WBS</th>
                <th className="text-center">URAIAN</th>
                <th className="text-center">RESOURCE / CREW</th>
                <th className="text-center">VOL</th>
                <th className="text-center">DUR</th>
                <th className="text-center">SISA TR (JAM)</th>
                <th className="text-center">BUTUH TR / HARI (JAM)</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r, i) => (
                <tr key={i}>
                  <td className="text-center">{r.wbs_code}</td>
                  <td className="text-left">{r.task_name}</td>
                  <td className="text-left">{r.resource_crew}</td>
                  <td className="text-center">{r.volume}</td>
                  <td className="text-center">{r.durasi} hr</td>
                  <td className="text-right font-bold">{formatNum(r.total_kebutuhan)}</td>
                  <td className={`text-right font-bold ${r.is_delayed ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatNum(r.kebutuhan_harian)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* HALAMAN 4: MATERIALS + SIGNATURES */}
        <div className="print-page-matrix">
          <div className="header">
             {/* 🟢 PERBAIKAN: Tambahkan Logo di Header Halaman 4 */}
             {projectInfo?.logo_url ? (
              <img src={projectInfo.logo_url} alt="Logo Proyek" style={{ height: '50px', width: 'auto', objectFit: 'contain' }} />
            ) : (
              <div style={{ height: '50px', width: '50px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '4px' }}>LOGO</div>
            )}
            <div>
              <div className="rev-box">REV: 01 | {new Date().toLocaleDateString('id-ID')}</div>
              <h1>PROJECT MASTER PROGRAM (PMP) - MATERIALS</h1>
              <h2>{projectInfo?.name || '-'}</h2>
              <div className="header-meta">
                <span>No. Kontrak: {projectInfo?.contract_number || '-'}</span>
                <span>Lokasi: {projectInfo?.location || '-'}</span>
              </div>
            </div>
          </div>
          <table style={{ width: '100%' }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-center">WBS</th>
                <th className="text-center">URAIAN</th>
                <th className="text-center">MATERIAL</th>
                <th className="text-center">KEBUTUHAN IDEAL</th>
                <th className="text-center">SATUAN</th>
                <th className="text-center">WASTE</th>
                <th className="text-center">SISA DIBELI</th>
                <th className="text-center">ESTIMASI SISA BIAYA</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m, i) => (
                <tr key={i}>
                  <td className="text-center">{m.wbs_code}</td>
                  <td className="text-left">{m.task_name}</td>
                  <td className="text-left">{m.material_name}</td>
                  <td className="text-right">{formatNum(m.kebutuhan_ideal)}</td>
                  <td style={{ textAlign: 'center' }}>{m.satuan}</td>
                  <td className="text-right" style={{ color: '#d97706' }}>{formatNum(m.waste)}</td>
                  <td className="text-right font-bold" style={{ color: '#1d4ed8' }}>{formatNum(m.total_dibeli)}</td>
                  <td className="text-right font-bold">{formatRp(m.estimasi_biaya)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {printConfig.showSignatures && (
            <div className="signature-wrapper">
              <div className="signature-box">
                <div className="signature-title">DIAJUKAN OLEH:</div>
                <div className="signature-company">{printConfig.dibuatInstansi}</div>
                <div className="signature-name-wrapper">
                  <div className="signature-name">{printConfig.dibuatNama}</div>
                </div>
                <div className="signature-role">{printConfig.dibuatJabatan}</div>
              </div>
              
              <div className="signature-box">
                <div className="signature-title">DIPERIKSA & DIVERIFIKASI OLEH:</div>
                <div className="signature-company">{printConfig.diperiksaInstansi}</div>
                <div className="signature-name-wrapper">
                  <div className="signature-name">{printConfig.diperiksaNama}</div>
                </div>
                <div className="signature-role">{printConfig.diperiksaJabatan}</div>
              </div>

              <div className="signature-box">
                <div className="signature-title">DISETUJUI & DISAHKAN OLEH:</div>
                <div className="signature-company">{printConfig.disetujuiInstansi}</div>
                <div className="signature-name-wrapper">
                  <div className="signature-name">{printConfig.disetujuiNama}</div>
                </div>
                {printConfig.disetujuiNip && (
                  <div className="signature-nip">NIP. {printConfig.disetujuiNip}</div>
                )}
                <div className="signature-role">{printConfig.disetujuiJabatan}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PRINT SETUP */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Settings size={18} className="text-indigo-600"/> Print Setup
              </h2>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 space-y-5 text-sm max-h-[70vh] overflow-y-auto">
              <div>
                <h3 className="font-bold text-slate-700 mb-2 border-b pb-1">Skala Waktu & Filter Gantt Chart</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Skala Waktu</label>
                    <select 
                      value={printConfig.timescale} 
                      onChange={(e) => setPrintConfig({...printConfig, timescale: e.target.value})} 
                      className="w-full border p-2 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Harian">Harian</option>
                      <option value="Mingguan">Mingguan</option>
                      <option value="Bulanan">Bulanan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Dari Tanggal</label>
                    <input 
                      type="date" 
                      value={printConfig.dateFrom} 
                      onChange={(e) => setPrintConfig({...printConfig, dateFrom: e.target.value})} 
                      className="w-full border p-2 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Sampai Tanggal</label>
                    <input 
                      type="date" 
                      value={printConfig.dateTo} 
                      onChange={(e) => setPrintConfig({...printConfig, dateTo: e.target.value})} 
                      className="w-full border p-2 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-700 mb-2 border-b pb-1">Watermark Dokumen</h3>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="watermark" value="DRAFT" checked={watermarkText === 'DRAFT'} onChange={(e) => setWatermarkText(e.target.value)} className="w-4 h-4 text-indigo-600" /> 
                    <span className="text-sm font-semibold">DRAFT</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="watermark" value="FINAL" checked={watermarkText === 'FINAL'} onChange={(e) => setWatermarkText(e.target.value)} className="w-4 h-4 text-indigo-600" /> 
                    <span className="text-sm font-semibold">FINAL</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-700 mb-2 border-b pb-1">Data Tanda Tangan</h3>
                
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input type="text" placeholder="Nama Site Engineer" value={printConfig.dibuatNama} onChange={(e) => setPrintConfig({...printConfig, dibuatNama: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                  <input type="text" placeholder="Jabatan" value={printConfig.dibuatJabatan} onChange={(e) => setPrintConfig({...printConfig, dibuatJabatan: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                  <input type="text" placeholder="Instansi" value={printConfig.dibuatInstansi} onChange={(e) => setPrintConfig({...printConfig, dibuatInstansi: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input type="text" placeholder="Nama Tim Leader" value={printConfig.diperiksaNama} onChange={(e) => setPrintConfig({...printConfig, diperiksaNama: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                  <input type="text" placeholder="Jabatan" value={printConfig.diperiksaJabatan} onChange={(e) => setPrintConfig({...printConfig, diperiksaJabatan: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                  <input type="text" placeholder="Instansi" value={printConfig.diperiksaInstansi} onChange={(e) => setPrintConfig({...printConfig, diperiksaInstansi: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-1">
                  <input type="text" placeholder="Nama Direksi/PPK" value={printConfig.disetujuiNama} onChange={(e) => setPrintConfig({...printConfig, disetujuiNama: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                  <input type="text" placeholder="NIP (Opsional)" value={printConfig.disetujuiNip} onChange={(e) => setPrintConfig({...printConfig, disetujuiNip: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Jabatan" value={printConfig.disetujuiJabatan} onChange={(e) => setPrintConfig({...printConfig, disetujuiJabatan: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                  <input type="text" placeholder="Instansi" value={printConfig.disetujuiInstansi} onChange={(e) => setPrintConfig({...printConfig, disetujuiInstansi: e.target.value})} className="w-full border p-1.5 rounded text-xs" />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-700 mb-2 border-b pb-1">Opsi Tampilan Lainnya</h3>
                <div className="space-y-2 text-xs font-bold text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={printConfig.showSignatures} onChange={(e) => setPrintConfig({...printConfig, showSignatures: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" /> 
                    Tampilkan Kolom Tanda Tangan
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={printConfig.showLegend} onChange={(e) => setPrintConfig({...printConfig, showLegend: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" /> 
                    Tampilkan Legend Gantt Chart
                  </label>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
              <button onClick={() => setIsPrintModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={handlePrint} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2">
                <Printer size={16}/> Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}