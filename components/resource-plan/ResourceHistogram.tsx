"use client";
import { useMemo, useState } from "react";
import { HistogramDataPoint } from "@/lib/utils/resource-histogram";
import { formatRupiah } from "@/lib/utils/resource-cost";

interface Props {
  data: HistogramDataPoint[];
  threshold?: number;
}

export function ResourceHistogram({ data, threshold: propThreshold }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { maxTeams, threshold, yLevels } = useMemo(() => {
    if (!data || data.length === 0) return { maxTeams: 1, threshold: propThreshold || 5, yLevels: [1, 0] };
    
    const teams = data.map(d => d.totalTeams);
    const max = Math.max(...teams, 1);
    
    let dynamicThreshold = propThreshold;
    if (!dynamicThreshold) {
      const sum = teams.reduce((a, b) => a + b, 0);
      const avg = sum / teams.length;
      dynamicThreshold = Math.max(avg * 1.25, 1.5); 
    }

    const chartMax = Math.max(Math.ceil(max), Math.ceil(dynamicThreshold) + 1);

    const y: number[] = [];
    if (chartMax <= 10) {
      for (let i = chartMax; i >= 0; i--) y.push(i);
    } else {
      const step = Math.ceil(chartMax / 5);
      for (let i = chartMax; i >= 0; i -= step) y.push(i);
      if (y[y.length - 1] !== 0) y.push(0);
    }

    return { maxTeams: chartMax, threshold: dynamicThreshold, yLevels: y };
  }, [data, propThreshold]);

  if (!data || data.length === 0) {
    return <div className="text-sm text-slate-500 p-10 text-center bg-white border border-slate-200 rounded-2xl shadow-sm font-medium">Belum ada data untuk Histogram.</div>;
  }

  const midIndex = Math.floor(data.length / 2);
  const limitLinePercent = (threshold / maxTeams) * 100;
  
  const formattedThreshold = threshold.toFixed(1).replace('.', ',');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 font-sans print:shadow-none print:border-slate-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-800 tracking-tight print:text-black">Resource Histogram</h3>
          <p className="text-sm text-slate-500 mt-1 font-medium print:text-slate-600">Visualisasi penumpukan tim per tanggal. Batang merah menandakan <i>Over-allocation</i>.</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 print:bg-white print:border-slate-300 print:text-black shadow-sm">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 block print:bg-emerald-600"></span> Normal</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500 block print:bg-rose-600"></span> Over-allocation</div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-0 border-t-2 border-solid border-rose-500 block print:border-black"></span> 
            Limit ({formattedThreshold} T/H)
          </div>
        </div>
      </div>

      <div className="flex h-80 w-full relative">
        <div className="w-16 h-full relative text-[10px] font-bold text-slate-500 print:text-black">
          {yLevels.map((val, idx) => {
            const bottomPercent = (val / maxTeams) * 100;
            return (
              <span key={idx} className="absolute right-3 -translate-y-1/2 tabular-nums" style={{ bottom: `${bottomPercent}%` }}>
                {val} T/H
              </span>
            );
          })}
        </div>

        <div className="relative flex-1 border-b-2 border-l-2 border-slate-300 print:border-slate-400">
          <div className="absolute inset-0 pointer-events-none">
            {yLevels.map((val, idx) => {
              const bottomPercent = (val / maxTeams) * 100;
              return (
                <div key={idx} className="absolute w-full border-t border-dashed border-slate-200 h-0 print:border-slate-300" style={{ bottom: `${bottomPercent}%` }}></div>
              );
            })}
          </div>

          <div className="absolute w-full border-t-2 border-rose-500 z-10 pointer-events-none flex items-center print:border-black border-dashed" style={{ bottom: `${limitLinePercent}%` }}>
            <span className="absolute right-4 -top-3 text-[10px] font-bold text-rose-600 bg-white px-2 py-0.5 rounded-md shadow-sm border border-rose-200 z-20 print:text-black print:border-slate-300">
              Batas Max
            </span>
          </div>

          <div className="absolute inset-0 flex items-end gap-[1px] w-full z-0">
            {data.map((d, i) => {
              const heightPercent = (d.totalTeams / maxTeams) * 100;
              const isOver = d.totalTeams > threshold;
              
              return (
                <div key={i} className="relative flex-1 h-full flex items-end group cursor-crosshair min-w-[3px]" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                  <div className={`w-full rounded-t-sm transition-all duration-150 ${isOver ? 'bg-rose-400 hover:bg-rose-500 print:bg-slate-700' : 'bg-emerald-400 hover:bg-emerald-500 print:bg-slate-400'}`} style={{ height: `${Math.max(heightPercent, 1)}%` }}></div>

                  {hoveredIndex === i && (
                    <div className={`absolute bottom-full mb-3 z-50 pointer-events-none ${i < 5 ? 'left-0' : i > data.length - 5 ? 'right-0' : 'left-1/2 -translate-x-1/2'} print:hidden`}>
                      <div className="bg-slate-800 text-white text-xs rounded-xl shadow-xl overflow-hidden min-w-[160px] border border-slate-700">
                        <div className="px-3 py-2 bg-slate-900 font-bold text-center border-b border-slate-700">{d.fullDate}</div>
                        <div className="p-3 space-y-2">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400 font-medium">Tim Kerja:</span>
                            <span className={`font-bold tabular-nums ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>{d.totalTeams.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400 font-medium">Biaya:</span>
                            <span className={`font-bold tabular-nums ${d.totalCost > 0 ? 'text-amber-300' : 'text-slate-400'}`}>{formatRupiah(d.totalCost)}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`w-2.5 h-2.5 bg-slate-800 rotate-45 absolute -bottom-1.5 border-r border-b border-slate-700 ${i < 5 ? 'left-4' : i > data.length - 5 ? 'right-4' : 'left-1/2 -translate-x-1/2'}`}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-between ml-16 mt-2 text-[10px] font-bold text-slate-500 print:text-black uppercase tracking-wider">
        <div className="flex flex-col items-center"><div className="w-px h-2 bg-slate-400 mb-1 print:bg-slate-600"></div><span>{data[0]?.date}</span></div>
        <div className="flex flex-col items-center"><div className="w-px h-2 bg-slate-400 mb-1 print:bg-slate-600"></div><span>{data[midIndex]?.date}</span></div>
        <div className="flex flex-col items-center"><div className="w-px h-2 bg-slate-400 mb-1 print:bg-slate-600"></div><span>{data[data.length - 1]?.date}</span></div>
      </div>
    </div>
  );
}