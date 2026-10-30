'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, BarChart3, DollarSign, Gauge, RefreshCw, TrendingUp, Wallet, LogOut, Calendar } from 'lucide-react';
import GanttWorkspace from './GanttWorkspace';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Line = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Line),
  { ssr: false }
);

export default function Dashboard({ projectId, userEmail }) {
  const [project, setProject] = useState(null);
  const [engineData, setEngineData] = useState(null);
  const [scurveData, setScurveData] = useState(null);
  const [lookaheadData, setLookaheadData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');

    try {
      // 1. Fetch Data Project
      const { data: projData, error: projErr } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (projErr) throw projErr;
      setProject(projData);

      // 2. Fetch Data CPM & AHSP Engine
      const engineRes = await fetch('/api/engine/cpm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const engineJson = await engineRes.json();
      if (engineJson.error) throw new Error(engineJson.error);
      setEngineData(engineJson);

      // 3. Fetch Data S-Curve dari API Baru
      const scurveRes = await fetch(`/api/analytics/scurve?project_id=${projectId}&timescale=week`);
      const scurveJson = await scurveRes.json();
      if (scurveJson.ok) setScurveData(scurveJson);

      // 4. Fetch Data Lookahead dari API Baru
      const statusDate = projData?.status_date || new Date().toISOString().split('T')[0];
      const lookaheadRes = await fetch(`/api/analytics/lookahead?project_id=${projectId}&status_date=${statusDate}&window_days=7`);
      const lookaheadJson = await lookaheadRes.json();
      if (lookaheadJson.ok) setLookaheadData(lookaheadJson.rows);

    } catch (e) {
      setError(e.message || 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runSync = async () => {
    setSyncing(true);
    await fetchAll();
    setSyncing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh(); 
  };

  // Konfigurasi Data S-Curve untuk Chart.js
  const chartData = useMemo(() => {
    if (!scurveData) return { labels: [], datasets: [] };
    return {
      labels: scurveData.labels,
      datasets: [
        {
          label: 'PV — Planned',
          data: scurveData.planned,
          borderColor: '#2563eb', // Biru
          backgroundColor: 'rgba(37,99,235,0.08)',
          pointRadius: 0, fill: true, tension: 0.3,
        },
        {
          label: 'EV — Earned',
          data: scurveData.earned,
          borderColor: '#16a34a', // Hijau
          backgroundColor: 'rgba(22,163,74,0.08)',
          pointRadius: 0, fill: true, tension: 0.3,
        },
        {
          label: 'AC — Actual',
          data: scurveData.actual,
          borderColor: '#dc2626', // Merah
          backgroundColor: 'rgba(220,38,38,0.06)',
          pointRadius: 0, fill: true, tension: 0.3,
        },
      ],
    };
  }, [scurveData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatIDR(ctx.parsed.y)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0 } },
      y: { beginAtZero: true, ticks: { callback: (v) => formatCompactIDR(v) } },
    },
  }), []);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Memuat Dashboard Enterprise...</div>;

  const evm = engineData?.evm || { bac: 0, pv: 0, ev: 0, ac: 0, cpi: 0, spi: 0, status_cpi: 'N/A', status_spi: 'N/A' };

  return (
    <div className="space-y-6">
      {/* HEADER DENGAN LOGO */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <img src="/logo-infrastruktur.jpeg" alt="Divisi Infrastruktur" className="brand-logo" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{project?.name || 'Project Dashboard'}</h1>
            <p className="text-sm text-slate-500">Status Date: {new Date(project?.status_date).toLocaleDateString('id-ID')} | User: {userEmail}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={runSync} disabled={syncing} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Activity className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Recalculating…' : 'Recalculate CPM & AHSP'}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg border border-red-200 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>}

      {/* KPI WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="RAB Project (BAC)" subtitle="Budget at Completion" value={formatIDR(evm.bac)} icon={DollarSign} tone="blue" />
        <KpiCard title="SPI" subtitle={evm.status_spi === 'CRITICAL' ? 'Terlambat' : 'Sesuai Jadwal'} value={evm.spi} icon={TrendingUp} tone={evm.spi >= 1 ? 'green' : 'red'} />
        <KpiCard title="CPI" subtitle={evm.status_cpi === 'CRITICAL' ? 'Overbudget' : 'Hemat'} value={evm.cpi} icon={Gauge} tone={evm.cpi >= 1 ? 'green' : 'red'} />
        <KpiCard title="EAC" subtitle={`VAC: ${formatIDR(evm.bac - (evm.bac / (evm.cpi || 1)))}`} value={formatIDR(evm.bac / (evm.cpi || 1))} icon={Wallet} tone="amber" />
      </div>

      {/* S-CURVE (Dari API Baru) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-900">S-Curve (PV / EV / AC)</h2>
        </div>
        <div className="h-[300px]">
          {!scurveData || scurveData.labels.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">Belum ada data S-Curve.</div>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* GANTT CHART AREA */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 bg-slate-50">
          <BarChart3 className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Interactive Gantt Workspace (CPM Engine)</h2>
        </div>
        <div className="h-[500px] p-4">
          <GanttWorkspace projectId={projectId} />
        </div>
      </div>

      {/* LOOKAHEAD (Dari API Baru) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Lookahead Schedule (7 Hari)</h2>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Task</th>
                <th className="px-4 py-2 text-left font-medium">WBS</th>
                <th className="px-4 py-2 text-center font-medium">Mat</th>
                <th className="px-4 py-2 text-center font-medium">Alat</th>
                <th className="px-4 py-2 text-center font-medium">Tng</th>
                <th className="px-4 py-2 text-right font-medium">Volume</th>
                <th className="px-4 py-2 text-right font-medium">Target/hr</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {lookaheadData.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 min-w-[200px]">{r.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.wbs || '-'}</td>
                  {['materialReady', 'alatReady', 'tenagaReady'].map((field) => (
                    <td key={field} className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!r[field]}
                        onChange={() => {}} // Dikosongkan sementara untuk UI
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums">{Number(r.volume || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(r.dailyTarget || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${r.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : r.status === 'ONGOING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {lookaheadData.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Tidak ada task dalam window Lookahead.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL BIAYA AHSP */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
          <h2 className="font-semibold text-slate-900">AHSP Resource Explosion (Direct Cost + Overhead 10%)</h2>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Pekerjaan (AHSP)</th>
                <th className="px-4 py-2 text-right font-medium">Direct Cost</th>
                <th className="px-4 py-2 text-right font-medium">Overhead (10%)</th>
                <th className="px-4 py-2 text-right font-medium">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {engineData?.resource_explosion?.map((r, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-4 py-2">{r.nama}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatIDR(r.direct_cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatIDR(r.indirect_cost)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold text-slate-800">{formatIDR(r.grand_total)}</td>
                </tr>
              ))}
              {!engineData?.resource_explosion?.length && (
                 <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Belum ada AHSP yang di-assign ke Task.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, subtitle, value, icon: Icon, tone }) {
  const toneMap = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">{title}</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-2 rounded-lg ${toneMap[tone]}`}><Icon className="w-5 h-5" /></div>
      </div>
    </div>
  );
}

function formatIDR(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatCompactIDR(value) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)} Jt`;
  if (abs >= 1_000) return `Rp ${(v / 1_000).toFixed(0)} Rb`;
  return `Rp ${v}`;
}