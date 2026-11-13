'use client';

import { AlertCircle, Clock } from 'lucide-react';

export default function ComplianceWidget() {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Cek Kepatuhan Harian</h3>
            <p className="text-xs text-slate-500">Berdasarkan SOP</p>
          </div>
        </div>
        <a href="/sop" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">
          Baca SOP Lengkap &rarr;
        </a>
      </div>

      <div className="space-y-3">
        {/* Item 1: GRN */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            <span className="text-sm font-semibold text-slate-700">Penerimaan Barang (GRN)</span>
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 flex items-center gap-1">
            <AlertCircle size={12} /> Ada PO Belum Diterima
          </span>
        </div>

        {/* Item 2: Kas Harian */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-sm font-semibold text-slate-700">Input Kas Harian</span>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100 flex items-center gap-1">
            <Clock size={12} /> Belum ada input hari ini
          </span>
        </div>
      </div>
    </div>
  );
}