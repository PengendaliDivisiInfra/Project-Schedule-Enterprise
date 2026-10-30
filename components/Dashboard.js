'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, BarChart3, DollarSign, Gauge, RefreshCw, TrendingUp, Wallet, LogOut } from 'lucide-react';
import GanttWorkspace from './GanttWorkspace';
import { useRouter } from 'next/navigation';

export default function Dashboard({ projectId, userEmail }) {
  const [project, setProject] = useState(null);
  const [engineData, setEngineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');

    try {
      const { data: projData, error: projErr } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (projErr) throw projErr;
      setProject(projData);

      const res = await fetch('/api/engine/cpm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      setEngineData(json);
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
    router.refresh(); // Refresh halaman agar kembali ke Login
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Memuat Dashboard Enterprise...</div>;

  const evm = engineData?.evm || { bac: 0, pv: 0, ev: 0, ac: 0, cpi: 0, spi: 0, status_cpi: 'N/A', status_spi: 'N/A' };

  return (
    <div className="space-y-6">
      {/* HEADER DENGAN LOGO */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          {/* Ganti path logo sesuai tempat Anda menyimpannya di folder public */}
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

      {/* GANTT CHART AREA */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 bg-slate-50">
          <BarChart3 className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Interactive Gantt Workspace (CPM Engine)</h2>
        </div>
        <div className="h-[600px] p-4">
          <GanttWorkspace projectId={projectId} />
        </div>
      </div>

      {/* DETAIL BIAYA */}
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