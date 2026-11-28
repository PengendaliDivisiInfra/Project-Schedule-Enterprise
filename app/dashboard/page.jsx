'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import {
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  ArrowUpRight,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ComplianceWidget from '@/components/dashboard/ComplianceWidget';
import LoadingSpinner from '../../components/LoadingSpinner';
import { saveToCache, getFromCache } from '../../lib/utils/cache';

export default function DashboardPage() {
  const { activeProjectId } = useProject();
  const [loading, setLoading] = useState(true);

  const [projectMeta, setProjectMeta] = useState(null);
  const [bac, setBac] = useState(0);
  const [contractValue, setContractValue] = useState(0);
  const [weightedProgress, setWeightedProgress] = useState(0);
  const [spi, setSpi] = useState(null);
  const [cpi, setCpi] = useState(null);
  const [sCurveData, setSCurveData] = useState([]);

  useEffect(() => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      const cacheKey = `dashboard_${activeProjectId}`;

      const cached = getFromCache(cacheKey);
      if (cached) {
        setProjectMeta(cached.projectMeta || null);
        setBac(cached.bac || 0);
        setContractValue(cached.contractValue || 0);
        setWeightedProgress(cached.weightedProgress || 0);
        setSpi(cached.spi);
        setCpi(cached.cpi);
        setSCurveData(cached.sCurveData || []);
      }

      if (typeof window !== 'undefined' && !navigator.onLine) {
        setLoading(false);
        if (!cached) {
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { type: 'warning', message: 'Anda offline dan belum ada data cache untuk proyek ini.' },
            })
          );
        }
        return;
      }

      try {
        const [{ data: project }, { data: tasks }] = await Promise.all([
          supabase
            .from('projects')
            .select('name, company_name, contract_number, contract_value, location, budget_hard_stop, ring_fenced_cashflow')
            .eq('id', activeProjectId)
            .single(),
          supabase
            .from('wbs_tasks')
            .select('cost, progress_percent, summary')
            .eq('project_id', activeProjectId),
        ]);

        let scurveData = [];
        try {
          const res = await fetch(`/api/analytics/scurve?project_id=${activeProjectId}`);
          if (res.ok) {
            const scurveRes = await res.json();
            if (scurveRes.ok && scurveRes.data) scurveData = scurveRes.data;
          }
        } catch (e) {
          console.warn('Gagal fetch S-Curve, mungkin offline', e);
        }

        let newBac = 0;
        let newWeightedProgress = 0;
        let newSpi = null;
        let newCpi = null;

        if (tasks && tasks.length > 0) {
          const leafTasks = tasks.filter((t) => t.summary !== 'Yes');
          newBac = leafTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);
          const totalWeightedCost = leafTasks.reduce(
            (sum, t) => sum + (Number(t.cost) || 0) * ((Number(t.progress_percent) || 0) / 100),
            0
          );
          newWeightedProgress = newBac > 0 ? (totalWeightedCost / newBac) * 100 : 0;

          if (scurveData.length > 0) {
            const validData = scurveData.filter(
              (d) => d.earned_value_cumulative !== null && d.actual_cost_cumulative !== null
            );
            const latestData = validData.length > 0 ? validData[validData.length - 1] : null;

            if (latestData) {
              const pv = latestData.planned_cost_cumulative || 0;
              const ev = newBac * (newWeightedProgress / 100);
              const ac = latestData.actual_cost_cumulative || 0;

              newSpi = pv > 0 ? ev / pv : null;
              newCpi = ac > 0 ? ev / ac : null;
            }
          }
        }

        const newContractValue = project ? Number(project.contract_value) || 0 : 0;

        setProjectMeta(project || null);
        setContractValue(newContractValue);
        setBac(newBac);
        setWeightedProgress(newWeightedProgress);
        setSpi(newSpi);
        setCpi(newCpi);
        setSCurveData(scurveData);

        saveToCache(cacheKey, {
          projectMeta: project || null,
          bac: newBac,
          contractValue: newContractValue,
          weightedProgress: newWeightedProgress,
          spi: newSpi,
          cpi: newCpi,
          sCurveData: scurveData,
        });
      } catch (err) {
        console.error('Error fetching dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [activeProjectId]);

  const formatRp = (num) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num || 0);

  const formatYAxis = (val) => {
    if (val === 0) return 'Rp 0';
    if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)} M`;
    return `Rp ${(val / 1000000).toFixed(0)} Jt`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/96 backdrop-blur-xl p-3.5 rounded-2xl shadow-modal border border-slate-200/80 text-xs">
          <p className="font-extrabold text-slate-900 mb-2 border-b border-slate-100 pb-1.5">{label}</p>
          {payload.map((entry, index) => {
            if (entry.value === null || entry.value === undefined) return null;
            return (
              <div key={index} className="flex justify-between items-center gap-5 mb-1">
                <span style={{ color: entry.color }} className="font-bold">
                  {entry.name}
                </span>
                <span className="font-mono font-bold text-slate-800 tabular-nums">{formatRp(entry.value)}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <LoadingSpinner text="Menyusun Dasbor Eksekutif & Analitik Kurva-S..." />;
  }

  if (!activeProjectId) {
    return (
      <div className="p-10 text-center text-slate-500 font-bold">
        Silakan pilih proyek di Header terlebih dahulu.
      </div>
    );
  }

  const isOverbudget = bac > contractValue && contractValue > 0;
  const maxVal = Math.max(bac, contractValue);
  const yAxisMax = Math.ceil(maxVal / 5000000000) * 5000000000 || 5000000000;

  return (
    <div className="w-full min-h-screen executive-canvas p-6 md:p-8">
      <div className="max-w-[1920px] mx-auto space-y-6">
        {/* EXECUTIVE GRADIENT HERO BANNER WITH AUTO FONT CONTRAST */}
        <div className="relative overflow-hidden rounded-3xl bg-executive-gradient p-6 md:p-8 shadow-executive">
          <div className="pointer-events-none absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-16 w-56 h-56 rounded-full bg-black/10 blur-2xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider badge-auto-contrast">
                  <Sparkles size={12} /> Command Center Eksekutif
                </span>
                {projectMeta?.budget_hard_stop !== false && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold badge-auto-contrast">
                    <Lock size={11} /> Hard-Stop RAB Aktif
                  </span>
                )}
                {projectMeta?.ring_fenced_cashflow !== false && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold badge-auto-contrast">
                    <ShieldCheck size={11} /> Ring-Fenced Cashflow
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-auto-contrast">
                {projectMeta?.name || 'Dasbor Eksekutif (Waktu Nyata)'}
              </h1>
              <p className="text-sm text-auto-muted">
                {projectMeta?.company_name ? `${projectMeta.company_name} • ` : ''}
                {projectMeta?.location || 'Ringkasan performa Earned Value Management (EVM) & kontrol biaya lapangan.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/approvals"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold badge-auto-contrast hover:opacity-90 transition-all"
              >
                Alur Persetujuan <ArrowUpRight size={14} />
              </Link>
              <Link
                href="/finances"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold badge-auto-contrast hover:opacity-90 transition-all"
              >
                Arus Kas &amp; 3-Layer RAB <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {isOverbudget && (
          <div className="bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={22} />
            <div>
              <h4 className="font-extrabold">Peringatan Kritis: RAP Melebihi Nilai Kontrak!</h4>
              <p className="text-sm mt-0.5">
                Total Anggaran (RAB): <b className="font-mono">{formatRp(bac)}</b> lebih besar dari Nilai Kontrak:{' '}
                <b className="font-mono">{formatRp(contractValue)}</b>. Proyek terindikasi mengalami defisit margin.
              </p>
            </div>
          </div>
        )}

        {/* 4 EXECUTIVE KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-executive rounded-2xl p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${isOverbudget ? 'from-rose-500 to-red-600' : 'from-indigo-500 via-blue-500 to-cyan-400'}`} />
            <div className="flex justify-between items-start mb-3">
              <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Total Anggaran (RAB)</p>
              <div className={`p-2 rounded-xl ${isOverbudget ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                <DollarSign size={18} />
              </div>
            </div>
            <p className={`text-2xl font-extrabold font-mono tabular-nums tracking-tight ${isOverbudget ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatRp(bac)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
              Nilai Kontrak: <span className="font-mono font-bold text-slate-700">{formatRp(contractValue)}</span>
            </p>
          </div>

          <div className="card-executive rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400" />
            <div className="flex justify-between items-start mb-3">
              <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Progres Berbobot (EVM)</p>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={18} />
              </div>
            </div>
            <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">{weightedProgress.toFixed(2)}%</p>
            <div className="w-full h-2 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, weightedProgress))}%` }}
              />
            </div>
          </div>

          <div className="card-executive rounded-2xl p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${spi === null ? 'from-slate-300 to-slate-400' : spi >= 1 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-orange-500'}`} />
            <div className="flex justify-between items-start mb-3">
              <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Kinerja Jadwal (SPI)</p>
              <div className={`p-2 rounded-xl ${spi === null ? 'bg-slate-100 text-slate-400' : spi >= 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <Activity size={18} />
              </div>
            </div>
            <p className={`text-2xl font-extrabold font-mono tabular-nums ${spi === null ? 'text-slate-400' : spi >= 1 ? 'text-slate-900' : 'text-rose-600'}`}>
              {spi === null ? 'N/A' : spi.toFixed(2)}
            </p>
            <p className={`text-xs font-bold mt-1.5 ${spi === null ? 'text-slate-400' : spi >= 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {spi === null ? 'Belum Ada Jadwal' : spi >= 1 ? 'Sesuai / Lebih Cepat' : 'Terlambat dari Baseline'}
            </p>
          </div>

          <div className="card-executive rounded-2xl p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${cpi === null ? 'from-slate-300 to-slate-400' : cpi >= 1 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-orange-500'}`} />
            <div className="flex justify-between items-start mb-3">
              <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Kinerja Biaya (CPI)</p>
              <div className={`p-2 rounded-xl ${cpi === null ? 'bg-slate-100 text-slate-400' : cpi >= 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <p className={`text-2xl font-extrabold font-mono tabular-nums ${cpi === null ? 'text-slate-400' : cpi >= 1 ? 'text-slate-900' : 'text-rose-600'}`}>
              {cpi === null ? 'N/A' : cpi.toFixed(2)}
            </p>
            <p className={`text-xs font-bold mt-1.5 ${cpi === null ? 'text-slate-400' : cpi >= 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {cpi === null ? 'Belum Ada Realisasi' : cpi >= 1 ? 'Efisien / Sesuai Pagu' : 'Overbudget (Perlu Audit)'}
            </p>
          </div>
        </div>

        {/* S-CURVE ANALYTICS CARD */}
        <div className="card-executive p-6 rounded-2xl h-[500px] flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Grafik Kurva S (S-Curve EVM)</h3>
              <p className="text-xs text-slate-500">
                Visualisasi komparasi Rencana Kumulatif (Plan), Nilai Hasil (EV), dan Realisasi Biaya (AC).
              </p>
            </div>
            <Link
              href="/s-curve"
              className="text-xs font-bold hover:underline inline-flex items-center gap-1"
              style={{ color: 'var(--brand-accent)' }}
            >
              Buka Layar Penuh <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="flex-1 w-full min-h-[350px]">
            {sCurveData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sCurveData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, yAxisMax]}
                    allowDataOverflow={true}
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    width={90}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area
                    type="monotone"
                    dataKey="planned_cost_cumulative"
                    name="Rencana (Plan)"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorPlan)"
                  />
                  <Line
                    type="monotone"
                    dataKey="actual_cost_cumulative"
                    name="Realisasi Biaya (AC)"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="earned_value_cumulative"
                    name="Nilai Hasil (EV)"
                    stroke="#10b981"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <Activity className="w-12 h-12 mb-2 opacity-20" />
                <p className="font-semibold text-slate-500">Belum ada data Kurva S untuk proyek ini.</p>
              </div>
            )}
          </div>
        </div>

        {/* LIVE ENTERPRISE GOVERNANCE & COMPLIANCE RADAR */}
        <ComplianceWidget />
      </div>
    </div>
  );
}
