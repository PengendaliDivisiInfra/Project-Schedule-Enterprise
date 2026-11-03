'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useProject } from '../../../context/ProjectContext';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';

export default function MasterReportPage() {
  const { activeProjectId } = useProject();
  const [loading, setLoading] = useState(true);
  const [projectInfo, setProjectInfo] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!activeProjectId) return;
      setLoading(true);
      try {
        const [projRes, taskRes, resRes, matRes] = await Promise.all([
          supabase.from('projects').select('*').eq('id', activeProjectId).maybeSingle(),
          supabase.from('wbs_tasks').select('*').eq('project_id', activeProjectId).order('wbs_code'),
          supabase.from('v_resource_plan').select('*').eq('project_id', activeProjectId).order('wbs_code'),
          supabase.from('v_material_plan').select('*').eq('project_id', activeProjectId).order('wbs_code')
        ]);
        
        if (projRes.data) setProjectInfo(projRes.data);
        if (taskRes.data) setTasks(taskRes.data);
        if (resRes.data) setResources(resRes.data);
        if (matRes.data) setMaterials(matRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeProjectId]);

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;
  if (!activeProjectId) return <div className="p-10 text-center font-bold">Pilih proyek terlebih dahulu.</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-4 mb-6 print:hidden">
        <button onClick={() => window.history.back()} className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-2"><ArrowLeft size={16}/> Kembali</button>
        <div className="flex justify-end gap-3">
          <button onClick={() => window.print()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 hover:bg-indigo-700"><Printer size={18}/> Cetak / Simpan PDF</button>
        </div>
      </div>

      {/* DOKUMEN LAPORAN */}
      <div className="bg-white max-w-6xl mx-auto p-8 rounded-lg shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
        
        {/* HEADER KOP SURAT */}
        <div className="flex justify-between items-start border-b-4 border-slate-800 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 uppercase tracking-wide">PROJECT MASTER PROGRAM (PMP) - TIME SCHEDULE</h1>
            <h2 className="text-lg font-bold text-indigo-700 mt-1 uppercase">{projectInfo?.name}</h2>
            <div className="flex gap-6 text-xs text-slate-600 mt-2 font-medium">
              <span>No. Kontrak: {projectInfo?.contract_number || '-'}</span>
              <span>Lokasi: {projectInfo?.location || '-'}</span>
              <span>Tahun Anggaran: {projectInfo?.contract_date ? new Date(projectInfo.contract_date).getFullYear() : '-'}</span>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 border-l pl-4">
            <p className="font-bold text-slate-800">TANGGAL CETAK</p>
            <p>{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            <p className="mt-2 font-bold text-slate-800">REVISI</p>
            <p>00</p>
          </div>
        </div>

        {/* KOTAK RINGKASAN */}
        <div className="grid grid-cols-4 border border-slate-800 mb-8 bg-white text-xs">
          <div className="p-4 border-r border-slate-800">
            <p className="font-bold text-slate-500 mb-1 uppercase">Nilai Kontrak</p>
            <p className="text-lg font-extrabold text-slate-900">{formatRp(projectInfo?.contract_value)}</p>
          </div>
          <div className="p-4 border-r border-slate-800 bg-indigo-50/50">
            <p className="font-bold text-indigo-600 mb-1 uppercase">Target Rencana (%)</p>
            <p className="text-lg font-extrabold text-indigo-800">43.03%</p> {/* Bisa dinamis nanti */}
          </div>
          <div className="p-4 border-r border-slate-800 bg-emerald-50/50">
            <p className="font-bold text-emerald-600 mb-1 uppercase">Aktual Realisasi (%)</p>
            <p className="text-lg font-extrabold text-emerald-800">49.77%</p>
          </div>
          <div className="p-4 bg-slate-50">
            <p className="font-bold text-slate-500 mb-1 uppercase">Status Varian</p>
            <p className="text-lg font-extrabold text-slate-900">+6.74%</p>
          </div>
        </div>

        {/* TABEL 1: TIME SCHEDULE */}
        <h3 className="font-bold text-sm text-slate-800 mb-2 uppercase tracking-wide border-l-4 border-indigo-600 pl-2">Time Schedule (Gantt Chart)</h3>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
            <thead>
              <tr className="bg-slate-800 text-white uppercase tracking-wider">
                <th className="p-2 border border-slate-700">WBS</th>
                <th className="p-2 border border-slate-700">Task Name</th>
                <th className="p-2 border border-slate-700 text-center">Start</th>
                <th className="p-2 border border-slate-700 text-center">Finish</th>
                <th className="p-2 border border-slate-700 text-center">Dur</th>
                <th className="p-2 border border-slate-700 text-center">Pred</th>
                <th className="p-2 border border-slate-700 text-center">Float</th>
                <th className="p-2 border border-slate-700 text-center">% Complete</th>
                <th className="p-2 border border-slate-700 text-center">Target</th>
                <th className="p-2 border border-slate-700 text-center">Sisa Vol</th>
                <th className="p-2 border border-slate-700 text-center">T/Hr</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={i} className={t.is_summary ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'}>
                  <td className="p-1.5 border border-slate-300 font-mono">{t.wbs_code}</td>
                  <td className="p-1.5 border border-slate-300">{t.name}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{formatDate(t.start_date)}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{formatDate(t.end_date)}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.duration}d</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.predecessors || '-'}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.slack || 0}</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">{Number(t.progress_percent || 0).toFixed(2)}%</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.smart_target || 0}%</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.volume ? (t.volume - (t.volume * (t.progress_percent || 0)/100)).toFixed(2) : '-'}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.butuh_t_hr ? t.butuh_t_hr.toFixed(2) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TABEL 2: EVM */}
        <h3 className="font-bold text-sm text-slate-800 mb-2 uppercase tracking-wide border-l-4 border-indigo-600 pl-2">Matriks Task Management (EVM)</h3>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
            <thead>
              <tr className="bg-slate-800 text-white uppercase tracking-wider">
                <th className="p-2 border border-slate-700">WBS</th>
                <th className="p-2 border border-slate-700">Task Name</th>
                <th className="p-2 border border-slate-700 text-center">Vol Total</th>
                <th className="p-2 border border-slate-700 text-center">Durasi</th>
                <th className="p-2 border border-slate-700 text-center">Start</th>
                <th className="p-2 border border-slate-700 text-center">Finish</th>
                <th className="p-2 border border-slate-700 text-center">Vol Real</th>
                <th className="p-2 border border-slate-700 text-center">Sisa Vol</th>
                <th className="p-2 border border-slate-700 text-center">Target</th>
                <th className="p-2 border border-slate-700 text-center">Aktual</th>
                <th className="p-2 border border-slate-700 text-center">Varian</th>
                <th className="p-2 border border-slate-700 text-center">T/Hr</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={i} className={t.is_summary ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'}>
                  <td className="p-1.5 border border-slate-300 font-mono">{t.wbs_code}</td>
                  <td className="p-1.5 border border-slate-300">{t.name}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.volume || '-'}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.duration}d</td>
                  <td className="p-1.5 border border-slate-300 text-center">{formatDate(t.start_date)}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{formatDate(t.end_date)}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.actual_vol ? t.actual_vol.toFixed(2) : '-'}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.sisa_vol ? t.sisa_vol.toFixed(2) : '-'}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.smart_target || 0}%</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">{Number(t.progress_percent || 0).toFixed(2)}%</td>
                  <td className={`p-1.5 border border-slate-300 text-center font-bold ${t.varian_pct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{t.varian_pct ? t.varian_pct.toFixed(2) : 0}%</td>
                  <td className="p-1.5 border border-slate-300 text-center">{t.butuh_t_hr ? t.butuh_t_hr.toFixed(2) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TABEL 3: RESOURCE PLAN */}
        <h3 className="font-bold text-sm text-slate-800 mb-2 uppercase tracking-wide border-l-4 border-indigo-600 pl-2">Resource Requirement Plan</h3>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
            <thead>
              <tr className="bg-slate-800 text-white uppercase tracking-wider">
                <th className="p-2 border border-slate-700">WBS</th>
                <th className="p-2 border border-slate-700">Task Name</th>
                <th className="p-2 border border-slate-700">Resource / Crew</th>
                <th className="p-2 border border-slate-700 text-center">Vol</th>
                <th className="p-2 border border-slate-700 text-center">Dur</th>
                <th className="p-2 border border-slate-700 text-center">Koef</th>
                <th className="p-2 border border-slate-700 text-center">Total TR</th>
                <th className="p-2 border border-slate-700 text-center">Kebutuhan / Hari</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-1.5 border border-slate-300 font-mono">{r.wbs_code}</td>
                  <td className="p-1.5 border border-slate-300">{r.task_name}</td>
                  <td className="p-1.5 border border-slate-300 font-semibold">{r.resource_name}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{r.volume}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{r.duration} hr</td>
                  <td className="p-1.5 border border-slate-300 text-center">{r.koefisien}</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold text-indigo-700">{Number(r.total_kebutuhan).toFixed(2)} Jam</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold text-emerald-700">{Number(r.kebutuhan_harian).toFixed(2)} Jam</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TABEL 4: MATERIAL PLAN */}
        <h3 className="font-bold text-sm text-slate-800 mb-2 uppercase tracking-wide border-l-4 border-indigo-600 pl-2">Material Requirement Plan</h3>
        <div className="overflow-x-auto mb-12">
          <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
            <thead>
              <tr className="bg-slate-800 text-white uppercase tracking-wider">
                <th className="p-2 border border-slate-700">WBS</th>
                <th className="p-2 border border-slate-700">Task Name</th>
                <th className="p-2 border border-slate-700">Material</th>
                <th className="p-2 border border-slate-700 text-center">Kebutuhan Ideal</th>
                <th className="p-2 border border-slate-700 text-center">Waste</th>
                <th className="p-2 border border-slate-700 text-center">Total Dibeli</th>
                <th className="p-2 border border-slate-700 text-center">Delivery / Mgg</th>
                <th className="p-2 border border-slate-700 text-center">Estimasi Biaya</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-1.5 border border-slate-300 font-mono">{m.wbs_code}</td>
                  <td className="p-1.5 border border-slate-300">{m.task_name}</td>
                  <td className="p-1.5 border border-slate-300 font-semibold">{m.material_name}</td>
                  <td className="p-1.5 border border-slate-300 text-center">{Number(m.kebutuhan_ideal).toFixed(2)} {m.satuan}</td>
                  <td className="p-1.5 border border-slate-300 text-center text-amber-600">{Number(m.waste).toFixed(2)} {m.satuan}</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold text-blue-700">{Number(m.total_dibeli).toFixed(2)} {m.satuan}</td>
                  <td className="p-1.5 border border-slate-300 text-center text-emerald-600 font-semibold">{Number(m.delivery_per_week).toFixed(2)} {m.satuan}/mgg</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">{formatRp(m.estimasi_biaya)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TANDA TANGAN */}
        <div className="flex justify-between mt-16 pt-8 text-xs font-semibold text-slate-800 text-center">
          <div>
            <p className="mb-16">Dibuat Oleh</p>
            <p className="border-b border-slate-800 pb-1 px-8">( ......................................... )</p>
            <p className="mt-1">Site Engineer - Kontraktor</p>
          </div>
          <div>
            <p className="mb-16">Diperiksa Oleh</p>
            <p className="border-b border-slate-800 pb-1 px-8">( ......................................... )</p>
            <p className="mt-1">Tim Leader - Konsultan Supervisi</p>
          </div>
          <div>
            <p className="mb-16">Disetujui Oleh</p>
            <p className="border-b border-slate-800 pb-1 px-8">( ......................................... )</p>
            <p className="mt-1">Direksi - Instansi</p>
          </div>
        </div>

      </div>
    </div>
  );
}