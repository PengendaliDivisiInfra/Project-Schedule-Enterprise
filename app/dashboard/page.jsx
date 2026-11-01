'use client';
import { Activity, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Executive Dashboard</h1>
          <p className="text-sm text-slate-500">Ringkasan status proyek berdasarkan data aktual lapangan.</p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Total Anggaran (BAC)</p>
            <p className="text-2xl font-bold text-slate-800">Rp 99.700.000</p>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Earned Value (EV)</p>
            <p className="text-2xl font-bold text-slate-800">Rp 2.500.000</p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Schedule Performance (SPI)</p>
            <p className="text-2xl font-bold text-amber-600">0.85 <span className="text-xs font-normal text-slate-400">(Terlambat)</span></p>
          </div>
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Activity size={20} /></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Cost Performance (CPI)</p>
            <p className="text-2xl font-bold text-emerald-600">1.12 <span className="text-xs font-normal text-slate-400">(Hemat)</span></p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><AlertTriangle size={20} /></div>
        </div>
      </div>

      {/* PLACEHOLDER GRAFIK S-CURVE */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-96 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="z-10 text-center">
          <Activity size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-600 mb-1">Grafik Kurva S (S-Curve)</h3>
          <p className="text-sm text-slate-400">Visualisasi komparasi Rencana vs Aktual akan dirender di sini.</p>
        </div>
      </div>
    </div>
  );
}
