'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, Download, FileText, FileSpreadsheet, Activity } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TIPE DATA
// ═══════════════════════════════════════════════════════════════════════════
interface Task {
  id: string;
  parent_id: string | null;
  name: string;
  duration: number;
  start_date: string;
  end_date: string;
  wbs_code: string;
  predecessors: { task_id: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[];
  progress_percent: number;
  rab: number;
  cpi: number;
  spi: number;
}

// Mock Data untuk Demonstrasi Engine
const INITIAL_TASKS: Task[] = [
  { id: '1', parent_id: null, name: 'Pekerjaan Persiapan', duration: 5, start_date: '2026-11-01', end_date: '2026-11-05', wbs_code: '1', predecessors: [], progress_percent: 100, rab: 50000000, cpi: 1.1, spi: 1.0 },
  { id: '1.1', parent_id: '1', name: 'Mobilisasi', duration: 3, start_date: '2026-11-01', end_date: '2026-11-03', wbs_code: '1.1', predecessors: [], progress_percent: 100, rab: 20000000, cpi: 1.0, spi: 1.0 },
  { id: '1.2', parent_id: '1', name: 'Direksi Keet', duration: 2, start_date: '2026-11-04', end_date: '2026-11-05', wbs_code: '1.2', predecessors: [{ task_id: '1.1', type: 'FS', lag: 1 }], progress_percent: 100, rab: 30000000, cpi: 1.2, spi: 1.0 },
  { id: '2', parent_id: null, name: 'Pekerjaan Tanah', duration: 10, start_date: '2026-11-06', end_date: '2026-11-15', wbs_code: '2', predecessors: [{ task_id: '1', type: 'FS', lag: 0 }], progress_percent: 50, rab: 150000000, cpi: 0.9, spi: 0.8 },
  { id: '2.1', parent_id: '2', name: 'Galian Tanah', duration: 10, start_date: '2026-11-06', end_date: '2026-11-15', wbs_code: '2.1', predecessors: [{ task_id: '1.2', type: 'FS', lag: 0 }], progress_percent: 50, rab: 150000000, cpi: 0.9, spi: 0.8 },
];

export default function GanttWorkspacePage() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1', '2']));

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIKA AUTO-SCHEDULING (RECURSIVE ENGINE)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDurationChange = (taskId: string, newDuration: number) => {
    // 1. Update durasi task yang diubah
    let updatedTasks = tasks.map(t => t.id === taskId ? { ...t, duration: newDuration } : t);
    
    // 2. Panggil mesin penjadwalan ulang secara rekursif
    updatedTasks = recalculateSchedule(updatedTasks);
    
    // 3. Simpan ke state
    setTasks(updatedTasks);
  };

  const recalculateSchedule = (currentTasks: Task[]): Task[] => {
    // Clone array agar tidak memutasi state secara langsung
    const taskMap = new Map(currentTasks.map(t => [t.id, { ...t }]));
    
    // Urutkan task berdasarkan hierarki (induk dulu, baru anak)
    // Untuk simplifikasi, kita loop berulang (iterasi maksimal 10x untuk mencegah infinite loop)
    let maxIterations = 10;
    let hasChanged = true;

    while (hasChanged && maxIterations > 0) {
      hasChanged = false;

      taskMap.forEach(task => {
        // Jika task memiliki predecessor, sesuaikan tanggal mulainya
        if (task.predecessors && task.predecessors.length > 0) {
          let newStartDate = new Date(task.start_date).getTime();

          task.predecessors.forEach(pred => {
            const predTask = taskMap.get(pred.task_id);
            if (!predTask) return;

            const predEnd = new Date(predTask.end_date).getTime();
            const predStart = new Date(predTask.start_date).getTime();
            
            let requiredStart = newStartDate;

            // Logika Dependensi Finish-to-Start (FS)
            if (pred.type === 'FS') {
              requiredStart = predEnd + (pred.lag * 86400000); 
            }

            if (requiredStart > newStartDate) {
              newStartDate = requiredStart;
            }
          });

          const newStartDateObj = new Date(newStartDate);
          if (newStartDateObj.getTime() !== new Date(task.start_date).getTime()) {
            task.start_date = newStartDateObj.toISOString().split('T')[0];
            // Hitung ulang end_date berdasarkan duration
            const endDate = new Date(newStartDate);
            endDate.setDate(endDate.getDate() + task.duration);
            task.end_date = endDate.toISOString().split('T')[0];
            hasChanged = true;
          }
        }
      });
      maxIterations--;
    }

    return Array.from(taskMap.values());
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const exportToCSV = () => {
    const headers = ['WBS', 'Nama Task', 'Durasi', 'Mulai', 'Selesai', 'Progress', 'RAB', 'CPI', 'SPI'];
    const rows = tasks.map(t => [t.wbs_code, t.name, t.duration, t.start_date, t.end_date, `${t.progress_percent}%`, t.rab, t.cpi, t.spi]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_RAB_Gantt_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    // Implementasi ekspor PDF native browser (print dialog)
    window.print();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER UI
  // ═══════════════════════════════════════════════════════════════════════════
  const toggleNode = (id: string) => {
    const newSet = new Set(expandedNodes);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setExpandedNodes(newSet);
  };

  // Hitung lebar Gantt berdasarkan tanggal paling awal & akhir
  const minDate = new Date(Math.min(...tasks.map(t => new Date(t.start_date).getTime())));
  const maxDate = new Date(Math.max(...tasks.map(t => new Date(t.end_date).getTime())));
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800">
      {/* Header Workspace */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold">Workspace Proyek: Jembatan Cisomang</h1>
          <p className="text-sm text-slate-500">Auto-Scheduling Engine: Aktif</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100">
            <FileSpreadsheet className="w-4 h-4" /> Ekspor CSV
          </button>
          <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100">
            <FileText className="w-4 h-4" /> Cetak PDF
          </button>
        </div>
      </div>

      {/* Split Panel */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* KIRI: TREE TABLE WBS */}
        <div className="w-1/2 overflow-y-auto border-r border-slate-200 bg-white">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-500 sticky top-0">
              <tr>
                <th className="px-4 py-3 w-16">WBS</th>
                <th className="px-4 py-3">Nama Task</th>
                <th className="px-4 py-3 w-20">Durasi</th>
                <th className="px-4 py-3 w-32">RAB</th>
                <th className="px-4 py-3 w-16 text-center">CPI</th>
                <th className="px-4 py-3 w-16 text-center">SPI</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const isParent = tasks.some(t => t.parent_id === task.id);
                const isExpanded = expandedNodes.has(task.id);
                
                // Logika menyembunyikan anak jika induk tidak di-expand
                const isHidden = task.parent_id && !expandedNodes.has(task.parent_id);
                if (isHidden) return null;

                return (
                  <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{task.wbs_code}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center" style={{ paddingLeft: task.parent_id ? '20px' : '0' }}>
                        {isParent ? (
                          <button onClick={() => toggleNode(task.id)} className="mr-1 text-slate-400 hover:text-slate-700">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        ) : <span className="w-5 mr-1" />}
                        <span className={isParent ? 'font-semibold' : ''}>{task.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <input 
                        type="number" 
                        value={task.duration}
                        onChange={(e) => handleDurationChange(task.id, parseInt(e.target.value) || 0)}
                        className="w-16 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-2 tabular-nums">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(task.rab)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${task.cpi < 1 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{task.cpi}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${task.spi < 1 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{task.spi}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* KANAN: GANTT CHART VISUALIZATION */}
        <div className="w-1/2 overflow-y-auto bg-slate-50 p-4">
           <div className="relative min-h-[400px] border border-slate-200 bg-white rounded-lg shadow-sm">
              {/* Header Tanggal */}
              <div className="flex border-b border-slate-200 bg-slate-100 py-2">
                  <div className="w-full flex">
                    {Array.from({ length: Math.ceil(totalDays) + 1 }).map((_, i) => {
                      const d = new Date(minDate);
                      d.setDate(d.getDate() + i);
                      return <div key={i} className="flex-1 text-center text-[10px] text-slate-500 border-r border-slate-200 last:border-0">{d.getDate()}</div>
                    })}
                  </div>
              </div>

              {/* Bar Gantt */}
              <div className="p-2 space-y-2">
                {tasks.map(task => {
                   const start = new Date(task.start_date).getTime();
                   const end = new Date(task.end_date).getTime();
                   const offset = ((start - minDate.getTime()) / (1000 * 3600 * 24)) / totalDays * 100;
                   const width = Math.max(2, ((end - start) / (1000 * 3600 * 24)) / totalDays * 100);
                   
                   return (
                     <div key={task.id} className="relative h-8 bg-slate-50 rounded flex items-center border border-slate-100">
                       <div 
                          className={`absolute h-6 rounded opacity-80 ${task.progress_percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ left: `${offset}%`, width: `${width}%` }}
                       >
                          <span className="text-[10px] text-white pl-1 leading-6 whitespace-nowrap overflow-hidden">{task.name}</span>
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