"use client";
import type { ResourceRequirement, ResourceCostSummary } from "@/types/resource-plan";
import { calculateResourceCost, formatRupiah, summarizeResourceCosts } from "@/lib/utils/resource-cost";
import { AlertTriangle } from "lucide-react"; // <-- TAMBAHKAN BARIS INI

export function ResourceCostHeader({ summary }: { summary: ResourceCostSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 print:hidden">
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-emerald-500 flex flex-col justify-center">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Estimasi Sisa Biaya</div>
        <div className="text-2xl font-extrabold text-emerald-700 tabular-nums">{formatRupiah(summary.total_remaining_cost)}</div>
      </div>
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm border-l-4 border-l-blue-500 flex flex-col justify-center">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Biaya Harian Aktif</div>
        <div className="text-2xl font-extrabold text-blue-700 tabular-nums">{formatRupiah(summary.total_daily_cost)}<span className="text-sm font-medium text-slate-400">/hari</span></div>
      </div>
      <div className={`p-5 border rounded-2xl shadow-sm border-l-4 flex flex-col justify-center ${summary.lead_time_warning_count > 0 ? "border-rose-200 bg-rose-50 border-l-rose-500" : "bg-white border-slate-200 border-l-slate-300"}`}>
        <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${summary.lead_time_warning_count > 0 ? 'text-rose-600' : 'text-slate-500'}`}>Lead Time Warning</div>
        <div className={`text-2xl font-extrabold tabular-nums ${summary.lead_time_warning_count > 0 ? "text-rose-700" : "text-slate-700"}`}>{summary.lead_time_warning_count} <span className="text-sm font-medium">item</span></div>
      </div>
    </div>
  );
}

export function ResourceCostCells({ req }: { req: ResourceRequirement }) {
  const c = calculateResourceCost(req);
  return (
    <>
      <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-teal-50/20 tabular-nums">
        {formatRupiah(c.remaining_cost)}
        <div className="text-[10px] font-medium text-slate-500 mt-0.5">{c.teams_needed} tim × {c.remaining_days} hari</div>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex flex-wrap gap-1 justify-center">
          <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-lg border ${
            c.recommendation === "Normal" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
            c.recommendation === "Lembur" ? "bg-amber-50 text-amber-700 border-amber-200" : 
            c.recommendation === "Shift" ? "bg-orange-50 text-orange-700 border-orange-200" : 
            "bg-blue-50 text-blue-700 border-blue-200"
          }`}>{c.recommendation}</span>
          
          {c.is_lead_time_warning && <span className="px-2 py-1 text-[10px] uppercase font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1"><AlertTriangle size={10}/> Lead Time</span>}
        </div>
      </td>
    </>
  );
}

export function useCostSummary(reqs: ResourceRequirement[]): ResourceCostSummary {
  return summarizeResourceCosts(reqs);
}