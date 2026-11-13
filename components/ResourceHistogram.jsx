'use client';
import { useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, BarChart3, HardHat, Truck, Package } from 'lucide-react';

const ROW_H = 22;

export default function ResourceHistogram({
  calendarDays = [], pixelsPerDay = 36, scrollLeft = 0, totalWidth = 0, histogramData, showHistogram = true, onToggle,
}) {
  const { resourceRows, overallocatedCount } = useMemo(() => {
    const rows = histogramData?.resources || [];
    return { resourceRows: rows, overallocatedCount: histogramData?.overallocatedCount || 0 };
  }, [histogramData]);

  if (!showHistogram) {
    return (
      <div className="border-t border-slate-300 bg-slate-100 flex items-center px-2 shrink-0" style={{ height: 28 }}>
        <button onClick={onToggle} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors">
          <ChevronUp className="w-3.5 h-3.5" />
          <BarChart3 className="w-3.5 h-3.5" />
          Resource Histogram
          {overallocatedCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
              {overallocatedCount} overallocated
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t-2 border-slate-400 bg-white flex flex-col shrink-0" style={{ height: 160 }}>
      <div className="flex items-center justify-between px-2 py-1 bg-slate-100 border-b border-slate-300 shrink-0">
        <button onClick={onToggle} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 transition-colors">
          <ChevronDown className="w-3.5 h-3.5" />
          <BarChart3 className="w-3.5 h-3.5" />
          Resource Histogram
          {overallocatedCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              {overallocatedCount} overallocated
            </span>
          )}
        </button>
        <span className="text-[10px] text-slate-500 flex items-center gap-2">
          {resourceRows.length} resource(s) ·
          <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 bg-indigo-500 rounded-sm"></span>Normal</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 bg-rose-500 rounded-sm"></span>&gt; Kapasitas</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {resourceRows.length === 0 && (
          <div className="p-3 text-[11px] text-slate-400 text-center">
            Belum ada task assignment. Generate assignment dari AHSP terlebih dahulu.
          </div>
        )}

        {resourceRows.map((r) => {
          let safeTarget = Math.ceil(Math.abs(Number(r.maxCrewSize) || 0));
          if (!isFinite(safeTarget) || isNaN(safeTarget) || safeTarget < 0) safeTarget = 0;
          
          return (
            <div key={r.id} className="flex border-b border-slate-100" style={{ height: ROW_H }}>
              <div className="w-[938px] shrink-0 flex items-center px-2 text-[11px] bg-white border-r border-slate-300">
                <span className="w-6 flex justify-center text-center">
                  {['labor','tenaga','pekerja'].includes(r.category) ? <HardHat className="w-3.5 h-3.5 text-slate-500" /> :
                   ['equipment','alat'].includes(r.category) ? <Truck className="w-3.5 h-3.5 text-slate-500" /> : 
                   <Package className="w-3.5 h-3.5 text-slate-500" />}
                </span>
                <span className="w-56 truncate font-medium text-slate-700">{r.name}</span>
                <span className="w-16 text-slate-500 truncate">{r.unit}</span>
                <span className="w-20 text-center text-slate-500 font-mono text-[10px]">cap: {r.capacity.toFixed(1)}</span>
                
                <span className={`w-36 text-right font-mono text-[10px] pr-2 ${safeTarget > r.capacity ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                  Target: {safeTarget} unit/hr 
                  {safeTarget > 0 && (
                    <span className="block text-[9px] text-indigo-600 font-sans">
                      Need ~{safeTarget} unit/day
                    </span>
                  )}
                </span>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <div className="flex h-full" style={{ width: totalWidth, transform: `translateX(-${scrollLeft}px)` }}>
                  {calendarDays.map((cd, i) => {
                    const dStr = cd.dateStr;
                    const load = r.loadByDate[dStr] || 0;
                    const ratio = r.capacity > 0 ? load / r.capacity : 0;
                    const isOver = ratio > 1.0001;
                    const heightPct = Math.min(100, ratio * 100);
                    return (
                      <div key={i} className="relative flex items-end h-full" style={{ width: pixelsPerDay }} title={`${r.name}\n${dStr}\nLoad: ${load.toFixed(2)} hr\nCapacity: ${r.capacity.toFixed(2)} hr\n${isOver ? '⚠ OVERALLOCATED' : ''}`}>
                        {load > 0 && (
                          <div className={`w-full ${isOver ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ height: `${heightPct}%`, minHeight: 2 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}