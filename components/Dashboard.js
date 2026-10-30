'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  DollarSign,
  Gauge,
  Layers,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { computeEVM, computeScurve } from '@/lib/engines/schedulingEngine';

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

export default function Dashboard({ projectId }) {
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [baselines, setBaselines] = useState([]);
  const [calcRows, setCalcRows] = useState([]);
  const [hsdRows, setHsdRows] = useState([]);
  const [lookahead, setLookahead] = useState([]);

  const [activeTab, setActiveTab] = useState('baseline');
  const [selectedWbs, setSelectedWbs] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!projectId) {
      setError('projectId wajib diisi');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [
        projRes,
        tasksRes,
        baselinesRes,
        calcRes,
        hsdRes,
        lookaheadRes,
      ] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('wbs', { ascending: true })
          .order('task_code', { ascending: true }),
        supabase
          .from('baselines')
          .select('*')
          .eq('project_id', projectId)
          .order('slot_number', { ascending: true }),
        supabase
          .from('calculator_ahsp')
          .select('*')
          .eq('project_id', projectId)
          .order('wbs', { ascending: true }),
        supabase
          .from('master_hsd')
          .select('*')
          .eq('project_id', projectId)
          .order('kategori', { ascending: true }),
        supabase
          .from('lookahead_readiness')
          .select('*')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false }),
      ]);

      if (projRes.error) throw projRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (baselinesRes.error) throw baselinesRes.error;
      if (calcRes.error) throw calcRes.error;
      if (hsdRes.error) throw hsdRes.error;
      if (lookaheadRes.error) throw lookaheadRes.error;

      setProject(projRes.data);
      setTasks(tasksRes.data || []);
      setBaselines(baselinesRes.data || []);
      setCalcRows(calcRes.data || []);
      setHsdRows(hsdRes.data || []);
      setLookahead(lookaheadRes.data || []);
    } catch (e) {
      setError(e.message || 'Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Realtime subscription ───
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-dashboard-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calculator_ahsp', filter: `project_id=eq.${projectId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'master_hsd', filter: `project_id=eq.${projectId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lookahead_readiness', filter: `project_id=eq.${projectId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'baselines', filter: `project_id=eq.${projectId}` },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchAll]);

  const workDays = useMemo(() => {
    return String(project?.work_days || '1,2,3,4,5')
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => !isNaN(x));
  }, [project?.work_days]);

  const statusDate = useMemo(() => {
    return project?.status_date ? new Date(project.status_date) : new Date();
  }, [project?.status_date]);

  const evm = useMemo(() => {
    return computeEVM(tasks, {
      statusDate,
      workDays,
      method: 'Duration',
      wbsFilter: selectedWbs || null,
    });
  }, [tasks, statusDate, workDays, selectedWbs]);

  const scurve = useMemo(() => {
    return computeScurve(tasks, {
      statusDate,
      workDays,
      timescale: 'week',
      wbsFilter: selectedWbs || null,
      method: 'Duration',
    });
  }, [tasks, statusDate, workDays, selectedWbs]);

  const taskById = useMemo(() => {
    return new Map(tasks.map((t) => [t.id, t]));
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const wbsCmp = String(a.wbs || '').localeCompare(String(b.wbs || ''), undefined, {
        numeric: true,
      });
      if (wbsCmp !== 0) return wbsCmp;
      return String(a.task_code || '').localeCompare(String(b.task_code || ''), undefined, {
        numeric: true,
      });
    });
  }, [tasks]);

  const displayTasks = useMemo(() => {
    if (!selectedWbs) return sortedTasks;
    return sortedTasks.filter((t) => String(t.wbs || '').startsWith(selectedWbs));
  }, [sortedTasks, selectedWbs]);

  const chartData = useMemo(() => ({
    labels: scurve.labels,
    datasets: [
      {
        label: 'PV — Planned',
        data: scurve.planned,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.08)',
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'EV — Earned',
        data: scurve.earned,
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22,163,74,0.08)',
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'AC — Actual',
        data: scurve.actual,
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220,38,38,0.06)',
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      },
    ],
  }), [scurve]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatIDR(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 45, minRotation: 0 },
      },
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => formatCompactIDR(v) },
      },
    },
  }), []);

  const runSync = async (mode = 'FULL') => {
    setSyncing(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          mode,
          options: { evMethod: 'Duration', nearCriticalThreshold: 5 },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Sync gagal');

      setLastSync({ mode, at: new Date(), ...json });
      await fetchAll();
    } catch (e) {
      setError(e.message || 'Sync gagal');
    } finally {
      setSyncing(false);
    }
  };

  const activateBaseline = async (slot) => {
    setError('');
    const { error: updErr } = await supabase
      .from('projects')
      .update({ active_baseline_slot: slot })
      .eq('id', projectId);

    if (updErr) setError(updErr.message);
    else fetchAll();
  };

  const toggleLookahead = async (row, field) => {
    const next = !row[field];
    const { error: updErr } = await supabase
      .from('lookahead_readiness')
      .update({ [field]: next })
      .eq('id', row.id);

    if (updErr) setError(updErr.message);
    else {
      setLookahead((prev) =>
        prev.map((x) => (x.id === row.id ? { ...x, [field]: next } : x))
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Memuat dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {project?.name || 'Project Dashboard'}
          </h1>
          <p className="text-sm text-slate-500">
            Status date: {project?.status_date || '-'} · Baseline aktif: Slot{' '}
            {project?.active_baseline_slot ?? 0}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastSync && (
            <span className="text-xs text-slate-500">
              Sync {lastSync.mode} · {lastSync.elapsed_ms} ms
            </span>
          )}
          <button
            onClick={() => runSync('FULL')}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Recalculating…' : 'Recalculate CPM + EVM'}
          </button>
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="BAC"
          subtitle="Budget at Completion"
          value={formatIDR(evm.summary.BAC)}
          icon={DollarSign}
          tone="blue"
        />
        <KpiCard
          title="SPI"
          subtitle={evm.summary.scheduleStatus}
          value={Number(evm.summary.SPI || 0).toFixed(3)}
          icon={TrendingUp}
          tone={evm.summary.SPI >= 1 ? 'green' : 'red'}
        />
        <KpiCard
          title="CPI"
          subtitle={evm.summary.costStatus}
          value={Number(evm.summary.CPI || 0).toFixed(3)}
          icon={Gauge}
          tone={evm.summary.CPI >= 1 ? 'green' : 'red'}
        />
        <KpiCard
          title="EAC"
          subtitle={`VAC ${formatIDR(evm.summary.VAC)}`}
          value={formatIDR(evm.summary.EAC)}
          icon={Wallet}
          tone={evm.summary.VAC >= 0 ? 'green' : 'amber'}
        />
      </div>

      {/* S-Curve */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-500" />
            <div>
              <h2 className="font-semibold text-slate-900">S-Curve</h2>
              <p className="text-xs text-slate-500">
                PV / EV / AC · WBS {selectedWbs || 'ALL'}
              </p>
            </div>
          </div>

          {selectedWbs && (
            <button
              onClick={() => setSelectedWbs('')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Clear WBS filter: {selectedWbs}
            </button>
          )}
        </div>

        <div className="h-[320px]">
          {scurve.empty ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              Belum ada data S-Curve.
            </div>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* WBS Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-500" />
            <div>
              <h2 className="font-semibold text-slate-900">WBS Interactive Table</h2>
              <p className="text-xs text-slate-500">
                {displayTasks.length} task · Klik WBS untuk drill-down S-Curve
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">WBS</th>
                <th className="px-4 py-2 text-left font-medium">Task</th>
                <th className="px-4 py-2 text-right font-medium">Dur</th>
                <th className="px-4 py-2 text-left font-medium">Start</th>
                <th className="px-4 py-2 text-left font-medium">Finish</th>
                <th className="px-4 py-2 text-right font-medium">Progress</th>
                <th className="px-4 py-2 text-right font-medium">Slack</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayTasks.map((t) => {
                const isCritical = t.critical === 'Yes';
                const isSummary = t.summary === 'Yes';
                const indent = Math.max(1, Number(t.outline_level) || 1) * 16;

                return (
                  <tr
                    key={t.id}
                    className={[
                      'border-t border-slate-100',
                      isCritical ? 'bg-red-50/70 border-l-4 border-l-red-500' : '',
                      isSummary ? 'font-semibold bg-slate-50/50' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedWbs(t.wbs || '')}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {t.wbs || '-'}
                      </button>
                    </td>
                    <td className="px-4 py-2 min-w-[260px]">
                      <div style={{ paddingLeft: `${indent}px` }}>
                        <span className={isCritical ? 'text-red-800' : 'text-slate-800'}>
                          {t.name}
                        </span>
                        {isCritical && (
                          <span className="ml-2 inline-flex rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            CRITICAL
                          </span>
                        )}
                        {t.milestone === 'Yes' && (
                          <span className="ml-2 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            MILESTONE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.duration}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{t.start_date || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{t.finish_date || '-'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(t.progress || 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.slack ?? 0}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatIDR(t.cost)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-xs">{t.alert || '-'}</span>
                    </td>
                  </tr>
                );
              })}

              {displayTasks.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    Tidak ada task untuk filter WBS ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2">
          {[
            { id: 'baseline', label: 'Baseline Manager', icon: CalendarRange },
            { id: 'ahsp', label: 'AHSP Wizard', icon: Layers },
            { id: 'hsd', label: 'Master HSD', icon: DollarSign },
            { id: 'lookahead', label: 'Lookahead', icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {activeTab === 'baseline' && (
            <BaselinePanel
              baselines={baselines}
              activeSlot={project?.active_baseline_slot ?? 0}
              onActivate={activateBaseline}
            />
          )}

          {activeTab === 'ahsp' && (
            <AhspPanel
              rows={calcRows}
              onBulkAssign={() => runSync('AHSP_BATCH')}
              syncing={syncing}
            />
          )}

          {activeTab === 'hsd' && <HsdPanel rows={hsdRows} />}

          {activeTab === 'lookahead' && (
            <LookaheadPanel
              rows={lookahead}
              taskById={taskById}
              onToggle={toggleLookahead}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UI SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function KpiCard({ title, subtitle, value, icon: Icon, tone = 'blue' }) {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-50 text-slate-700',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className={`rounded-lg p-2 ${toneMap[tone] || toneMap.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function BaselinePanel({ baselines, activeSlot, onActivate }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Slot</th>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Created</th>
            <th className="px-4 py-2 text-right font-medium">Tasks</th>
            <th className="px-4 py-2 text-right font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {baselines.map((b) => (
            <tr key={b.id} className="border-t border-slate-100">
              <td className="px-4 py-2">
                <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  Slot {b.slot_number}
                </span>
              </td>
              <td className="px-4 py-2">{b.name}</td>
              <td className="px-4 py-2 text-slate-500">
                {b.created_at ? new Date(b.created_at).toLocaleString('id-ID') : '-'}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{b.task_count ?? 0}</td>
              <td className="px-4 py-2 text-right">
                {activeSlot === b.slot_number ? (
                  <span className="text-xs font-medium text-emerald-600">Aktif</span>
                ) : (
                  <button
                    onClick={() => onActivate(b.slot_number)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Aktifkan
                  </button>
                )}
              </td>
            </tr>
          ))}

          {baselines.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                Belum ada baseline snapshot.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AhspPanel({ rows, onBulkAssign, syncing }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">AHSP Wizard</h3>
          <p className="text-xs text-slate-500">
            Bulk assign komponen AHSP ke task berdasarkan WBS.
          </p>
        </div>
        <button
          onClick={onBulkAssign}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Layers className="w-4 h-4" />
          {syncing ? 'Memproses…' : 'Bulk Assign AHSP'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">WBS</th>
              <th className="px-4 py-2 text-left font-medium">Item</th>
              <th className="px-4 py-2 text-right font-medium">Volume</th>
              <th className="px-4 py-2 text-right font-medium">Cost</th>
              <th className="px-4 py-2 text-left font-medium">Imported</th>
              <th className="px-4 py-2 text-left font-medium">Task ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 whitespace-nowrap">{r.wbs || '-'}</td>
                <td className="px-4 py-2 min-w-[220px]">{r.item_name || '-'}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {Number(r.volume || 0).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatIDR(r.cost)}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={[
                      'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                      r.imported === 'Yes'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600',
                    ].join(' ')}
                  >
                    {r.imported || 'No'}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {r.task_id ? String(r.task_id).slice(0, 8) : '-'}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Belum ada data calculator AHSP.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HsdPanel({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Kategori</th>
            <th className="px-4 py-2 text-left font-medium">Komponen</th>
            <th className="px-4 py-2 text-left font-medium">Satuan</th>
            <th className="px-4 py-2 text-right font-medium">Harga AHSP</th>
            <th className="px-4 py-2 text-right font-medium">Harga Aktual</th>
            <th className="px-4 py-2 text-right font-medium">Deviasi</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-2">{r.kategori}</td>
              <td className="px-4 py-2 min-w-[220px]">{r.komponen}</td>
              <td className="px-4 py-2">{r.satuan}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatIDR(r.harga_ahsp)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatIDR(r.harga_aktual)}
              </td>
              <td
                className={[
                  'px-4 py-2 text-right tabular-nums',
                  Number(r.deviasi) > 0
                    ? 'text-red-600'
                    : Number(r.deviasi) < 0
                    ? 'text-emerald-600'
                    : 'text-slate-600',
                ].join(' ')}
              >
                {formatIDR(r.deviasi)}
              </td>
              <td className="px-4 py-2">
                <span
                  className={[
                    'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                    r.status === 'NAIK'
                      ? 'bg-red-100 text-red-700'
                      : r.status === 'TURUN'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600',
                  ].join(' ')}
                >
                  {r.status}
                </span>
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                Belum ada data Master HSD.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LookaheadPanel({ rows, taskById, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Task</th>
            <th className="px-4 py-2 text-left font-medium">WBS</th>
            <th className="px-4 py-2 text-center font-medium">Material</th>
            <th className="px-4 py-2 text-center font-medium">Alat</th>
            <th className="px-4 py-2 text-center font-medium">Tenaga</th>
            <th className="px-4 py-2 text-right font-medium">Volume</th>
            <th className="px-4 py-2 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const task = taskById.get(r.task_id);
            return (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 min-w-[220px]">
                  {task?.name || r.task_id}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{task?.wbs || '-'}</td>
                {['material_ready', 'alat_ready', 'tenaga_ready'].map((field) => (
                  <td key={field} className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!r[field]}
                      onChange={() => onToggle(r, field)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                ))}
                <td className="px-4 py-2 text-right tabular-nums">
                  {Number(r.volume || 0).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-2 text-slate-500">{r.notes || '-'}</td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                Belum ada data lookahead readiness.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════

function formatIDR(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatCompactIDR(value) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)} Jt`;
  if (abs >= 1_000) return `Rp ${(v / 1_000).toFixed(0)} Rb`;
  return `Rp ${v}`;
}