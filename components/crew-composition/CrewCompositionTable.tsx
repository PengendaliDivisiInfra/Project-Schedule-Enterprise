"use client";
import { Pencil, PowerOff } from "lucide-react";
import type { CrewComposition } from "@/types/resource-plan";
import { formatRupiah } from "@/lib/utils/resource-cost";

export function CrewCompositionTable({ rows, onEdit, onDeactivate }: { rows: CrewComposition[], onEdit: (r: CrewComposition) => void, onDeactivate: (r: CrewComposition) => void }) {
  if (rows.length === 0) return <div className="p-8 text-center border rounded-lg border-dashed">Belum ada komposisi tim.</div>;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
          <tr>
            <th className="px-3 py-2">Kode</th><th className="px-3 py-2">Nama Tim</th><th className="px-3 py-2 text-right">Mandor</th>
            <th className="px-3 py-2 text-right">Tukang</th><th className="px-3 py-2 text-right">Pekerja</th>
            <th className="px-3 py-2 text-right">Kapasitas/Hari</th><th className="px-3 py-2 text-right">Biaya/Hari</th><th className="px-3 py-2 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{row.code}</td><td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 text-right">{row.mandor_count}</td><td className="px-3 py-2 text-right">{row.tukang_count}</td>
              <td className="px-3 py-2 text-right">{row.pekerja_count}</td><td className="px-3 py-2 text-right">{row.capacity_per_day} {row.unit}/hari</td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatRupiah(row.daily_cost)}</td>
              <td className="px-3 py-2 flex justify-center gap-1">
                <button onClick={() => onEdit(row)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                <button onClick={() => onDeactivate(row)} className="p-1 text-red-600 hover:bg-red-50 rounded"><PowerOff size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}