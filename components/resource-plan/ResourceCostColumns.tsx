"use client";
import type { ResourceRequirement, ResourceCostSummary } from "@/types/resource-plan";
import { calculateResourceCost, formatRupiah, summarizeResourceCosts } from "@/lib/utils/resource-cost";

export function ResourceCostHeader({ summary }: { summary: ResourceCostSummary }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-4">
      <div className="p-3 bg-white border rounded-lg"><div className="text-xs uppercase text-gray-500">Total Estimasi Sisa Biaya</div><div className="text-2xl font-bold text-emerald-700">{formatRupiah(summary.total_remaining_cost)}</div></div>
      <div className="p-3 bg-white border rounded-lg"><div className="text-xs uppercase text-gray-500">Biaya Harian Aktif</div><div className="text-2xl font-bold text-blue-700">{formatRupiah(summary.total_daily_cost)}/hari</div></div>
      <div className={`p-3 border rounded-lg ${summary.lead_time_warning_count > 0 ? "border-red-300 bg-red-50" : "bg-white"}`}><div className="text-xs uppercase text-gray-500">Lead Time Warning</div><div className={`text-2xl font-bold ${summary.lead_time_warning_count > 0 ? "text-red-700" : "text-gray-700"}`}>{summary.lead_time_warning_count} item</div></div>
    </div>
  );
}

export function ResourceCostCells({ req }: { req: ResourceRequirement }) {
  const c = calculateResourceCost(req);
  return (
    <>
      <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatRupiah(c.remaining_cost)}<div className="text-[10px] font-normal text-gray-500">{c.teams_needed} tim × {c.remaining_days} hari</div></td>
      <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
        <span className={`px-1.5 py-0.5 text-[11px] font-semibold rounded ${c.recommendation === "Normal" ? "bg-green-100 text-green-700" : c.recommendation === "Lembur" ? "bg-amber-100 text-amber-700" : c.recommendation === "Shift" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{c.recommendation}</span>
        {c.is_lead_time_warning && <span className="px-1.5 py-0.5 text-[11px] font-semibold text-red-700 bg-red-100 rounded">⚠ Lead Time</span>}
      </div></td>
    </>
  );
}

export function useCostSummary(reqs: ResourceRequirement[]): ResourceCostSummary {
  return summarizeResourceCosts(reqs);
}