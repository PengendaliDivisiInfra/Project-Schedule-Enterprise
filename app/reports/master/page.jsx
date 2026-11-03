'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { updateProjectScheduleSecure } from '../../../lib/scheduler';
import { calculateEVM } from '../../../lib/evm';
import { Printer, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import PrintSetupModal from '../../../components/PrintSetupModal';

export const dynamic = 'force-dynamic';

export default function MasterReportPage() {
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [ganttData, setGanttData] = useState([]);
  const [ganttMonths, setGanttMonths] = useState([]);
  const [resourcesPlan, setResourcesPlan] = useState([]);
  const [materialsPlan, setMaterialsPlan] = useState([]);
  const [health, setHealth] = useState({ totalCost: 0, targetPct: 0, actualPct: 0, varian: 0 });
  const [loading, setLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [printSettings, setPrintSettings] = useState({
    orientation: 'landscape',
    paperSize: 'A4',
    timescale: 'mingguan',
    startDate: '',
    endDate: '',
    showLegend: true,
    showSignature: true,
    columns: {
      wbs: true, name: true, duration: true, start: true, finish: true, 
      pred: true, slack: true, progress: true, target: true, sisa: true, tgtHr: true, cost: false
    },
    signatures: {
      created: { title: 'Dibuat Oleh', name: '', role: 'Site Engineer', instansi: 'Kontraktor' },
      checked: { title: 'Diperiksa Oleh', name: '', role: 'Tim Leader', instansi: 'Konsultan Supervisi' },
      approved: { title: 'Disetujui Oleh', name: '', role: 'Direksi', instansi: 'Instansi' }
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: projData } = await supabase.from('projects').select('*').limit(1).maybeSingle();
    if (projData) setProject(projData);

    let workingDays = [1,2,3,4,5];
    let exceptions = [];
    if (projData) {
      if (projData.working_days) workingDays = Array.isArray(projData.working_days) ? projData.working_days.map(Number) : [1,2,3,4,5];
      if (projData.exceptions) exceptions = projData.exceptions;
    }

    const { data: taskData } = await supabase.from('wbs_tasks').select('*').order('wbs_code');
    if (taskData) {
        const formattedTasks = taskData.map(t => ({ ...t, volume: Number(t.volume) || 0, duration: Number(t.duration) || 1 }));
        const cpmResult = updateProjectScheduleSecure(formattedTasks, workingDays, exceptions);
        const cpmTasks = cpmResult.success ? cpmResult.tasks : formattedTasks;
        const evmTasks = calculateEVM(cpmTasks);
        setTasks(evmTasks);

        const leafTasks = evmTasks.filter(t => t.summary !== 'Yes');
        let totalCost = 0, totalTarget = 0, totalActual = 0, totalWeight = 0;
        leafTasks.forEach(t => {
            const weight = (Number(t.cost) > 0) ? Number(t.cost) : (Number(t.duration) || 1);
            totalCost += Number(t.cost) || 0;
            totalWeight += weight;
            totalTarget += weight * ((t.smart_target || 0) / 100);
            totalActual += weight * ((Number(t.progress_percent) || 0) / 100);
        });
        const targetPct = totalWeight > 0 ? (totalTarget / totalWeight) * 100 : 0;
        const actualPct = totalWeight > 0 ? (totalActual / totalWeight) * 100 : 0;
        setHealth({ totalCost, targetPct, actualPct, varian: actualPct - targetPct });

        if (leafTasks.length > 0) {
            const startDates = leafTasks.map(t => new Date(t.early_start || t.start_date).getTime());
            const endDates = leafTasks.map(t => new Date(t.early_finish || t.end_date).getTime());
            const minDate = Math.min(...startDates);
            const maxDate = Math.max(...endDates);
            const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

            const computedGantt = leafTasks.map(t => {
                const tStart = new Date(t.early_start || t.start_date).getTime();
                const tEnd = new Date(t.early_finish || t.end_date).getTime();
                const leftDays = Math.max(0, (tStart - minDate) / (1000 * 60 * 60 * 24));
                const widthDays = Math.max(1, (tEnd - tStart) / (1000 * 60 * 60 * 24));
                return { ...t, leftPct: (leftDays / totalDays) * 100, widthPct: (widthDays / totalDays) * 100 };
            });
            setGanttData(computedGantt);

            const months = [];
            let current = new Date(minDate);
            current.setDate(1);
            while (current <= maxDate) {
                const nextMonth = new Date(current);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                const start = current < minDate ? minDate : current;
                const end = nextMonth > maxDate ? maxDate : nextMonth;
                const daysInMonth = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
                const pct = (daysInMonth / totalDays) * 100;
                months.push({ label: current.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }), width: pct });
                current = nextMonth;
            }
            setGanttMonths(months);
        }
    }

    const { data: resData } = await supabase.from('v_resource_requirements').select('*').order('wbs_code');
    if (resData) setResourcesPlan(resData.filter(r => r.resource_type === 'Tenaga Kerja' || r.resource_type === 'Alat'));

    const { data: matData } = await supabase.from('task_material_requirements')
        .select('*, wbs_tasks(name, wbs_code, duration), master_hsd(nama_item, satuan, harga_dasar)')
        .order('created_at', { ascending: false });
    if (matData) setMaterialsPlan(matData);

    setLoading(false);
  };

  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontWeight: 'bold' }}>Menyiapkan Laporan Eksekutif...</div>;

  return (
    <div className="bg-slate-100 min-h-screen p-4 md:p-8 font-sans print:bg-white print:p-0 print:min-h-0 print:overflow-visible">

      {/* TOOLBAR */}
      <div className="no-print max-w-6xl mx-auto mb-4 flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold px-2">
          <ArrowLeft className="w-5 h-5" /> Kembali
        </Link>
        <div className="flex gap-3">
            <button onClick={() => { router.refresh(); fetchData(); }} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm text-sm">
                <RefreshCw className="w-4 h-4" /> Sync Data
            </button>
            <button onClick={() => setIsPrintModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md text-sm">
                <Printer className="w-4 h-4" /> Cetak PDF
            </button>
        </div>
      </div>

      {/* KERTAS LAPORAN */}
      <div className="print-container max-w-[297mm] mx-auto bg-white shadow-2xl print:shadow-none print:w-full print:max-w-none">

        {/* HALAMAN 1 */}
        <div className="page-break">
            {/* HEADER RAPIH */}
            <div className="print-header flex justify-between items-start border-b-[3px] border-slate-900 pb-3 mb-6">
                <div className="flex-1 pr-4">
                    <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase m-0 leading-tight">
                        PROJECT MASTER PROGRAM (PMP) - TIME SCHEDULE
                    </h1>
                    <h2 className="text-sm font-extrabold text-indigo-700 mt-2 mb-0 uppercase">
                        {project?.name}
                    </h2>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[11px] text-slate-600 font-semibold">
                        <span>No. Kontrak: {project?.contract_number || '-'}</span>
                        <span>Lokasi: {project?.location || '-'}</span>
                        <span>Tahun Anggaran: {project?.budget_year || '-'}</span>
                    </div>
                </div>
                <div className="text-right shrink-0 min-w-[120px] border-l border-slate-300 pl-4">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tanggal Cetak</p>
                    <p className="text-sm font-mono font-bold text-slate-900 mb-2">{formatDate(new Date().toISOString())}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Revisi</p>
                    <p className="text-sm font-mono font-bold text-slate-900">00</p>
                </div>
            </div>

            <table className="evm-cards">
                <tr>
                    <td className="card bg-slate">
                        <p>NILAI KONTRAK</p>
                        <h3>{formatRp(project?.contract_value)}</h3>
                    </td>
                    <td className="card bg-indigo">
                        <p>TARGET RENCANA (%)</p>
                        <h3>{health.targetPct.toFixed(2)}%</h3>
                    </td>
                    <td className="card bg-emerald">
                        <p>AKTUAL REALISASI (%)</p>
                        <h3>{health.actualPct.toFixed(2)}%</h3>
                    </td>
                    <td className={`card ${health.varian < 0 ? 'bg-red' : 'bg-emerald'}`}>
                        <p>STATUS VARIAN</p>
                        <h3>
                            {health.varian < 0 ? '?' : '?'}
                            {health.varian > 0 ? '+' : ''}{health.varian.toFixed(2)}%
                        </h3>
                    </td>
                </tr>
            </table>

            <h3 className="section-title">TIME SCHEDULE (GANTT CHART)</h3>

            <table className="data-table gantt-table">
                <colgroup>
                    {printSettings.columns.wbs && <col style={{ width: '4%' }} />}
                    {printSettings.columns.name && <col style={{ width: '20%' }} />}
                    {printSettings.columns.volume && <col style={{ width: '6%' }} />}
                    {printSettings.columns.start && <col style={{ width: '8%' }} />}
                    {printSettings.columns.finish && <col style={{ width: '8%' }} />}
                    {printSettings.columns.duration && <col style={{ width: '5%' }} />}
                    {printSettings.columns.pred && <col style={{ width: '6%' }} />}
                    {printSettings.columns.slack && <col style={{ width: '5%' }} />}
                    {printSettings.columns.progress && <col style={{ width: '5%' }} />}
                    {printSettings.columns.target && <col style={{ width: '6%' }} />}
                    {printSettings.columns.sisa && <col style={{ width: '6%' }} />}
                    {printSettings.columns.tgtHr && <col style={{ width: '6%' }} />}
                    {printSettings.columns.cost && <col style={{ width: '7%' }} />}
                    <col style={{ width: 'auto' }} />
                </colgroup>
                <thead>
                    <tr>
                        {printSettings.columns.wbs && <th>WBS</th>}
                        {printSettings.columns.name && <th style={{ textAlign: 'left' }}>TASK NAME</th>}
                        {printSettings.columns.volume && <th>VOL</th>}
                        {printSettings.columns.start && <th>START</th>}
                        {printSettings.columns.finish && <th>FINISH</th>}
                        {printSettings.columns.duration && <th>DUR</th>}
                        {printSettings.columns.pred && <th>PRED</th>}
                        {printSettings.columns.slack && <th>FLOAT</th>}
                        {printSettings.columns.progress && <th>%</th>}
                        {printSettings.columns.target && <th>TARGET</th>}
                        {printSettings.columns.sisa && <th>SISA</th>}
                        {printSettings.columns.tgtHr && <th>T/HR</th>}
                        {printSettings.columns.cost && <th>COST</th>}
                        <th style={{ padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tr>
                                    {ganttMonths.map((m, i) => (
                                        <td key={i} style={{ width: `${m.width}%`, borderLeft: '1px solid #64748b', fontSize: '9px', textAlign: 'center', color: 'white', fontWeight: 'bold', padding: '4px 0' }}>
                                            {m.label.replace(' 20', " '")}
                                        </td>
                                    ))}
                                </tr>
                            </table>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.filter(t => t.summary !== 'Yes').map((t, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                            {printSettings.columns.wbs && <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{t.wbs_code}</td>}
                            {printSettings.columns.name && <td style={{ fontWeight: '600' }}>{t.name}</td>}
                            {printSettings.columns.volume && <td style={{ textAlign: 'center' }}>{t.volume}</td>}
                            {printSettings.columns.start && <td style={{ textAlign: 'center' }}>{formatDate(t.start_date).replace(' 2026','26')}</td>}
                            {printSettings.columns.finish && <td style={{ textAlign: 'center' }}>{formatDate(t.end_date).replace(' 2026','26')}</td>}
                            {printSettings.columns.duration && <td style={{ textAlign: 'center' }}>{t.duration}d</td>}
                            {printSettings.columns.pred && <td style={{ textAlign: 'center' }}>{t.predecessors || '-'}</td>}
                            {printSettings.columns.slack && <td style={{ textAlign: 'center' }}>{t.is_critical ? '0' : '-'}</td>}
                            {printSettings.columns.progress && <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{t.progress_percent}%</td>}
                            {printSettings.columns.target && <td style={{ textAlign: 'center', color: '#4338ca', fontWeight: 'bold' }}>{(t.smart_target||0).toFixed(0)}%</td>}
                            {printSettings.columns.sisa && <td style={{ textAlign: 'center', color: '#ea580c', fontWeight: 'bold' }}>{(t.sisa_vol||0).toFixed(0)}</td>}
                            {printSettings.columns.tgtHr && <td style={{ textAlign: 'center' }}>{(t.butuh_t_hr||0).toFixed(1)}</td>}
                            {printSettings.columns.cost && <td style={{ textAlign: 'right' }}>{formatRp(t.cost)}</td>}
                            <td style={{ padding: 0, position: 'relative', backgroundColor: '#f8fafc', backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px)', backgroundSize: '5% 100%' }}>
                                {ganttData[i] && (
                                    <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `${ganttData[i].leftPct}%`, width: `${ganttData[i].widthPct}%`, height: '12px', backgroundColor: t.is_critical ? '#ef4444' : '#3b82f6', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${t.progress_percent}%`, height: '100%', backgroundColor: 'rgba(0,0,0,0.2)' }}></div>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* LOGIKA LEGEND MUNCUL */}
            {printSettings.showLegend && (
                <div className="legend">
                    <div><span className="box normal"></span> Normal</div>
                    <div><span className="box critical"></span> Kritis</div>
                </div>
            )}
        </div>

        {/* HALAMAN 2 */}
        <div className="page-break">
            <h3 className="section-title">MATRIKS TASK MANAGEMENT (EVM)</h3>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>WBS</th><th>TASK NAME</th><th>VOL TOTAL</th><th>DURASI</th>
                        <th>START</th><th>FINISH</th><th>VOL. REAL.</th><th>SISA VOL</th>
                        <th>TARGET</th><th>AKTUAL</th><th>VARIAN</th><th>T/HR</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map(t => {
                        const isSummary = t.summary === 'Yes';
                        const varian = t.varian_pct || 0;
                        return (
                            <tr key={t.id} className={isSummary ? 'row-summary' : ''}>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{t.wbs_code}</td>
                                <td style={{ fontWeight: isSummary ? 'bold' : 'normal' }}>{t.name}</td>
                                <td style={{ textAlign: 'center' }}>{isSummary ? '-' : t.volume}</td>
                                <td style={{ textAlign: 'center' }}>{t.duration}d</td>
                                <td style={{ textAlign: 'center' }}>{formatDate(t.start_date)}</td>
                                <td style={{ textAlign: 'center' }}>{formatDate(t.end_date)}</td>
                                <td style={{ textAlign: 'center', color: '#2563eb' }}>{isSummary ? '-' : Number(t.actual_vol || 0).toFixed(2)}</td>
                                <td style={{ textAlign: 'center', color: '#ea580c' }}>{isSummary ? '-' : Number(t.sisa_vol || 0).toFixed(2)}</td>
                                <td style={{ textAlign: 'center', color: '#4338ca' }}>{isSummary ? '-' : `${(t.smart_target || 0).toFixed(1)}%`}</td>
                                <td style={{ textAlign: 'center', color: '#2563eb' }}>{isSummary ? '-' : `${Number(t.progress_percent || 0).toFixed(1)}%`}</td>
                                <td style={{ textAlign: 'center', fontWeight: 'bold', color: varian < 0 ? '#dc2626' : (varian > 0 ? '#059669' : '#64748b') }}>
                                    {isSummary ? '-' : `${varian > 0 ? '+' : ''}${varian.toFixed(1)}%`}
                                </td>
                                <td style={{ textAlign: 'center' }}>{isSummary || t.volume === 0 ? '-' : Number(t.butuh_t_hr || 0).toFixed(3)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

        {/* HALAMAN 3 */}
        <div className="page">
            <h3 className="section-title">RESOURCE REQUIREMENT PLAN</h3>
            <table className="data-table" style={{ marginBottom: '30px' }}>
                <thead>
                    <tr>
                        <th>WBS</th><th>TASK NAME</th><th>RESOURCE / CREW</th>
                        <th>VOL</th><th>DUR</th><th>KOEF</th><th>TOTAL TR</th><th>KEBUTUHAN HARIAN</th>
                    </tr>
                </thead>
                <tbody>
                    {resourcesPlan.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{r.wbs_code}</td>
                            <td style={{ fontWeight: '600' }}>{r.task_name}</td>
                            <td style={{ fontWeight: 'bold', color: '#4338ca' }}>{r.resource_name} <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'normal' }}>({r.resource_type})</span></td>
                            <td style={{ textAlign: 'center' }}>{r.volume}</td>
                            <td style={{ textAlign: 'center' }}>{r.duration} hr</td>
                            <td style={{ textAlign: 'center' }}>{r.koefisien}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#4338ca' }}>{Number(r.total_requirement).toFixed(2)} {r.unit}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#059669' }}>{Number(r.daily_requirement).toFixed(2)} {r.unit}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h3 className="section-title">MATERIAL REQUIREMENT PLAN</h3>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>WBS</th><th>TASK NAME</th><th>MATERIAL</th>
                        <th>KEBUTUHAN IDEAL</th><th>WASTE</th><th>TOTAL DIBELI</th>
                        <th>DELIVERY / MGG</th><th>ESTIMASI BIAYA</th>
                    </tr>
                </thead>
                <tbody>
                    {materialsPlan.map((m, i) => {
                        const volumeIdeal = Number(m.volume_requirement) || 0;
                        const totalDibeli = Number(m.actual_requirement) || 0;
                        const waste = totalDibeli - volumeIdeal;
                        const durasiMinggu = (m.wbs_tasks?.duration || 1) / 7;
                        const deliveryRate = durasiMinggu > 0 ? totalDibeli / durasiMinggu : 0;
                        const biaya = totalDibeli * (Number(m.master_hsd?.harga_dasar) || 0);
                        const satuan = m.master_hsd?.satuan || '';
                        return (
                            <tr key={i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{m.wbs_tasks?.wbs_code}</td>
                                <td style={{ fontWeight: '600' }}>{m.wbs_tasks?.name}</td>
                                <td style={{ fontWeight: 'bold' }}>{m.master_hsd?.nama_item}</td>
                                <td style={{ textAlign: 'center' }}>{volumeIdeal.toFixed(2)} {satuan}</td>
                                <td style={{ textAlign: 'center', color: '#ea580c' }}>{waste.toFixed(2)} {satuan}</td>
                                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#4338ca' }}>{totalDibeli.toFixed(2)} {satuan}</td>
                                <td style={{ textAlign: 'center', color: '#059669' }}>{deliveryRate.toFixed(2)} {satuan}/mgg</td>
                                <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatRp(biaya)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* LOGIKA TANDA TANGAN MUNCUL */}
            {printSettings.showSignature && (
                <div className="signature-block">
                    {['created', 'checked', 'approved'].map((key) => (
                        <div key={key} className="signature-col">
                            <p className="sig-title">{printSettings.signatures[key].title}</p>
                            <p className="sig-role">{printSettings.signatures[key].role}</p>
                            <div className="sig-space"></div>
                            <p className="sig-name">( {printSettings.signatures[key].name || '..............................'} )</p>
                            <p style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{printSettings.signatures[key].instansi}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      <PrintSetupModal 
        isOpen={isPrintModalOpen} 
        onClose={() => setIsPrintModalOpen(false)} 
        defaultSettings={printSettings}
        onPrint={(settings) => {
          setPrintSettings(settings);
          setIsPrintModalOpen(false);
          setTimeout(() => { window.print(); }, 800); 
        }} 
      />

            <style jsx global>{`
        /* CSS Web & Print Dasar */
        .print-container { width: 100%; }
        .print-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
        .print-header h1 { font-size: 22px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; line-height: 1.2; }
        .print-header h2 { font-size: 16px; font-weight: 800; color: #4338ca; margin: 8px 0 0 0; text-transform: uppercase; }
        
        .evm-cards { width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-left: -12px; margin-bottom: 25px; }
        .card { width: 25%; padding: 12px; border-radius: 4px; border: 1px solid; }
        .card p { margin: 0; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        .card h3 { margin: 4px 0 0 0; font-size: 18px; font-weight: 900; }
        .bg-slate { background-color: #f8fafc; border-color: #cbd5e1; } .bg-slate p { color: #64748b; } .bg-slate h3 { color: #0f172a; }
        .bg-indigo { background-color: #eef2ff; border-color: #c7d2fe; } .bg-indigo p { color: #4338ca; } .bg-indigo h3 { color: #312e81; }
        .bg-emerald { background-color: #ecfdf5; border-color: #a7f3d0; } .bg-emerald p { color: #047857; } .bg-emerald h3 { color: #064e3b; }
        .bg-red { background-color: #fef2f2; border-color: #fecaca; } .bg-red p { color: #b91c1c; } .bg-red h3 { color: #991b1b; }

        .section-title { font-size: 14px; font-weight: 900; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th { background-color: #1e293b; color: white; padding: 8px 6px; text-align: center; font-weight: 800; border: 1px solid #475569; text-transform: uppercase; font-size: 9px; }
        .data-table td { border: 1px solid #cbd5e1; padding: 5px 6px; }
        .row-even { background-color: #ffffff; } .row-odd { background-color: #f8fafc; } .row-summary { background-color: #e2e8f0 !important; }
        
        .gantt-table tr { height: 26px; }
        .legend { display: flex; gap: 20px; justify-content: flex-end; font-size: 10px; margin-top: 15px; font-weight: bold; }
        .box { display: inline-block; width: 16px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
        .box.normal { background-color: #3b82f6; } .box.critical { background-color: #ef4444; }

        .signature-block { margin-top: 40px; padding-top: 15px; border-top: 2px solid #1e293b; display: flex; justify-content: space-around; text-align: center; }
        .signature-col { width: 30%; }
        .sig-title { width: 100%; text-align: center; font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 4px; }
        .sig-role { width: 100%; text-align: center; font-size: 14px; font-weight: 900; color: #0f172a; margin-bottom: 50px; }
        .sig-name { width: 100%; text-align: center; font-size: 13px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #94a3b8; padding-bottom: 4px; display: inline-block; }

        /* ========================================= */
        /* CSS KHUSUS UNTUK MODE PRINT (PEMICU HALAMAN) */
        /* ========================================= */
        @media print {
          @page { 
            size: ${printSettings.orientation} ${printSettings.paperSize}; 
            margin: 10mm; 
          }
          
          /* 1. PAKSA BODY & CONTAINER UNTUK MELUBER (MENGATASI 1 HALAMAN) */
          html, body, #__next, main, aside, .min-h-screen, .h-screen, .overflow-hidden {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* 2. SEMBUNYIKAN SIDEBAR, TOPBAR, & TOMBOL */
          aside, header, nav, .no-print {
            display: none !important;
          }

          /* 3. MARGIN & LEBAR LAPORAN */
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* 4. PEMISAHAN HALAMAN (PAGE BREAK) */
          .page-break {
            page-break-after: always;
            break-after: page;
          }

          /* 5. ATURAN TABEL TIDAK TERPOTONG */
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }

          /* 6. ELEMEN YANG TIDAK BOLEH TERPOTONG */
          .signature-block, .evm-cards, .print-header {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

