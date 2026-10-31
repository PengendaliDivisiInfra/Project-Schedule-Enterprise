'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function WeeklyReportPage() {
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState([]);
  const [projectInfo, setProjectInfo] = useState({});
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7);
  const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);

  const [dateStart, setDateStart] = useState(lastWeek.toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(today.toISOString().split('T')[0]);
  const [prevDateStart, setPrevDateStart] = useState(twoWeeksAgo.toISOString().split('T')[0]);
  const [prevDateEnd, setPrevDateEnd] = useState(lastWeek.toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    const { data: pData } = await supabase.from('projects').select('*').limit(1).maybeSingle();
    if (pData) setProjectInfo(pData);

    const { data: tData } = await supabase.from('wbs_tasks').select(`id, name, wbs_code, summary, volume, cost, mata_varian, ahsp_templates(unit)`).order('wbs_code');
    if (tData) {
      const uniqueTasks = Array.from(new Map(tData.map(item => [item.wbs_code, item])).values());
      setTasks(uniqueTasks.map(t => ({ ...t, satuan_hsd: t.ahsp_templates?.unit || 'unit', volume: Number(t.volume) || 0, cost: Number(t.cost) || 0 })));
    }
    const { data: rData } = await supabase.from('daily_progress').select('*');
    setRecords(rData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const weekNumber = useMemo(() => {
    if (!projectInfo.contract_start) return 'Minggu Ke-1';
    const start = new Date(projectInfo.contract_start);
    const current = new Date(dateStart);
    const diffTime = Math.abs(current - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const week = Math.ceil(diffDays / 7);
    const month = Math.ceil(diffDays / 30);
    return `Minggu Ke-${week} / Bulan Ke-${month}`;
  }, [projectInfo.contract_start, dateStart]);

  const reportData = useMemo(() => {
    let totalRAB = 0;
    tasks.filter(t => t.summary === 'No').forEach(t => { totalRAB += t.cost; });

    const rows = tasks.map(t => {
      const isSummary = t.summary === 'Yes';
      const taskRecords = records.filter(r => r.task_id === t.id);

      const volSdIni = taskRecords.filter(r => new Date(r.record_date) <= new Date(dateEnd)).reduce((sum, r) => sum + Number(r.completed_volume), 0);
      const volLalu = taskRecords.filter(r => new Date(r.record_date) <= new Date(prevDateEnd)).reduce((sum, r) => sum + Number(r.completed_volume), 0);
      const volMingguIni = taskRecords.filter(r => new Date(r.record_date) >= new Date(dateStart) && new Date(r.record_date) <= new Date(dateEnd)).reduce((sum, r) => sum + Number(r.completed_volume), 0);

      const hargaSatuan = t.volume > 0 ? (t.cost / t.volume) : 0;
      
      const bobotKontrak = totalRAB > 0 ? (t.cost / totalRAB) * 100 : 0;
      const bobotLalu = totalRAB > 0 ? ((volLalu * hargaSatuan) / totalRAB) * 100 : 0;
      const bobotMingguIni = totalRAB > 0 ? ((volMingguIni * hargaSatuan) / totalRAB) * 100 : 0;
      const bobotSdIni = totalRAB > 0 ? ((volSdIni * hargaSatuan) / totalRAB) * 100 : 0;

      return {
        ...t, isSummary, volSdIni, volLalu, volMingguIni, hargaSatuan,
        bobotKontrak, bobotLalu, bobotMingguIni, bobotSdIni
      };
    });

    const totalPctKumulatif = totalRAB > 0 ? (rows.reduce((sum, r) => sum + (r.isSummary ? 0 : r.bobotSdIni), 0)) : 0;
    return { rows, totalRAB, totalPctKumulatif };
  }, [tasks, records, dateStart, dateEnd, prevDateStart, prevDateEnd]);

  if (loading) return <LoadingSpinner text="Menyusun laporan..." />;

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .print-hidden { display: none !important; }
          body { background-color: white !important; }
          .print-container { box-shadow: none !important; border: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="p-4 bg-gray-100 min-h-screen overflow-x-auto print:p-0 print:bg-white">
        <div className="print-hidden mb-4 flex justify-between items-end max-w-[297mm] mx-auto bg-white p-3 rounded shadow">
          <div className="flex gap-4">
             <div><label className="block text-xs font-bold">Mulai Minggu Ini</label><input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="border p-1 text-sm rounded" /></div>
             <div><label className="block text-xs font-bold">Selesai Minggu Ini</label><input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="border p-1 text-sm rounded" /></div>
             <div><label className="block text-xs font-bold">Mulai Minggu Lalu</label><input type="date" value={prevDateStart} onChange={e => setPrevDateStart(e.target.value)} className="border p-1 text-sm rounded" /></div>
             <div><label className="block text-xs font-bold">Selesai Minggu Lalu</label><input type="date" value={prevDateEnd} onChange={e => setPrevDateEnd(e.target.value)} className="border p-1 text-sm rounded" /></div>
          </div>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-blue-700">🖨️ Cetak PDF</button>
        </div>

        <div className="print-container bg-white mx-auto p-6 shadow-xl border border-gray-300 text-[9px] text-black" style={{ width: '297mm', minHeight: '210mm' }}>
          <h1 className="text-center font-bold text-lg mb-2 uppercase">Laporan Mingguan / Bulanan Progress Fisik Konstruksi</h1>
          
          <div className="flex justify-between mb-2 border-b-2 border-black pb-2">
            <div className="space-y-1 w-1/2">
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nama Paket Proyek</span><span>:</span><span className="border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>{projectInfo.name || 'Nama Proyek'}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Kontraktor Pelaksana</span><span>:</span><span className="border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>PT. Kontraktor (Edit)</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Total Nilai Kontrak</span><span>:</span><span className="px-1 font-bold">Rp {(projectInfo.contract_value || 0).toLocaleString('id-ID')}</span></div>
            </div>
            <div className="space-y-1 w-1/2 text-right">
              <div className="grid grid-cols-[130px_10px_1fr]"><span>Periode Pelaksanaan</span><span>:</span><span className="px-1 font-bold">{weekNumber}</span></div>
              <div className="grid grid-cols-[130px_10px_1fr]"><span>Rentang Tanggal</span><span>:</span><span>{new Date(dateStart).toLocaleDateString('id-ID')} s.d {new Date(dateEnd).toLocaleDateString('id-ID')}</span></div>
            </div>
          </div>

          <table className="w-full border-collapse border border-black">
            <thead className="bg-[#d1d5db] font-bold text-center">
              <tr>
                <th className="border border-black p-0.5" rowSpan={2}>No</th>
                <th className="border border-black p-0.5" rowSpan={2}>No. Mata Varian</th>
                <th className="border border-black p-0.5 text-left" rowSpan={2}>Uraian Pekerjaan</th>
                <th className="border border-black p-0.5" rowSpan={2}>Satuan</th>
                <th className="border border-black p-0.5" rowSpan={2}>Harga Satuan (Rp)</th>
                <th className="border border-black p-0.5" rowSpan={2}>Volume Kontrak</th>
                <th className="border border-black p-0.5" rowSpan={2}>Total Harga Kontrak</th>
                <th className="border border-black p-0.5" rowSpan={2}>Bobot Kontrak (%)</th>
                <th className="border border-black p-0.5" colSpan={3}>Progress Minggu Lalu</th>
                <th className="border border-black p-0.5" colSpan={3}>Progress Minggu Ini</th>
                <th className="border border-black p-0.5" colSpan={3}>Progress s.d Minggu Ini</th>
                <th className="border border-black p-0.5" rowSpan={2}>Target Kurva-S (%)</th>
                <th className="border border-black p-0.5" rowSpan={2}>Deviasi (+/-)</th>
              </tr>
              <tr>
                <th className="border border-black p-0.5">Vol</th><th className="border border-black p-0.5">Jumlah Harga</th><th className="border border-black p-0.5">Bobot (%)</th>
                <th className="border border-black p-0.5">Vol</th><th className="border border-black p-0.5">Jumlah Harga</th><th className="border border-black p-0.5">Bobot (%)</th>
                <th className="border border-black p-0.5">Vol</th><th className="border border-black p-0.5">Jumlah Harga</th><th className="border border-black p-0.5">Bobot (%)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.rows.map((row) => {
                const isSummary = row.isSummary;
                return (
                  <tr key={row.id} className={`${isSummary ? 'bg-gray-200 font-bold' : ''}`}>
                    <td className="border border-black p-0.5 text-center">{row.wbs_code}</td>
                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : (row.mata_varian || '-')}</td>
                    <td className="border border-black p-0.5">{row.name}</td>
                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.satuan_hsd}</td>
                    <td className="border border-black p-0.5 text-right">{isSummary ? '' : `Rp ${row.hargaSatuan.toLocaleString('id-ID')}`}</td>
                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.volume}</td>
                    <td className="border border-black p-0.5 text-right">{isSummary ? '' : `Rp ${row.cost.toLocaleString('id-ID')}`}</td>
                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.bobotKontrak.toFixed(2)}%</td>
                    
                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.volLalu.toFixed(2)}</td>
                    <td className="border border-black p-0.5 text-right">{isSummary ? '' : `Rp ${(row.volLalu * row.hargaSatuan).toLocaleString('id-ID')}`}</td>
                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.bobotLalu.toFixed(2)}%</td>

                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.volMingguIni.toFixed(2)}</td>
                    <td className="border border-black p-0.5 text-right">{isSummary ? '' : `Rp ${(row.volMingguIni * row.hargaSatuan).toLocaleString('id-ID')}`}</td>
                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.bobotMingguIni.toFixed(2)}%</td>

                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.volSdIni.toFixed(2)}</td>
                    <td className="border border-black p-0.5 text-right">{isSummary ? '' : `Rp ${(row.volSdIni * row.hargaSatuan).toLocaleString('id-ID')}`}</td>
                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : row.bobotSdIni.toFixed(2)}%</td>

                    <td className="border border-black p-0.5 text-center">{isSummary ? '' : `0%`}</td>
                    <td className={`border border-black p-0.5 text-center font-bold`}>
                      {isSummary ? '' : `0%`}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#d1d5db] font-bold">
                <td className="border border-black p-1 text-center" colSpan={7}>TOTAL</td>
                <td className="border border-black p-1 text-center">{reportData.rows.reduce((sum, r) => sum + (r.isSummary ? 0 : r.bobotKontrak), 0).toFixed(2)}%</td>
                <td className="border border-black p-1 text-center" colSpan={2}></td>
                <td className="border border-black p-1 text-center">{reportData.rows.reduce((sum, r) => sum + (r.isSummary ? 0 : r.bobotLalu), 0).toFixed(2)}%</td>
                <td className="border border-black p-1 text-center" colSpan={2}></td>
                <td className="border border-black p-1 text-center">{reportData.rows.reduce((sum, r) => sum + (r.isSummary ? 0 : r.bobotMingguIni), 0).toFixed(2)}%</td>
                <td className="border border-black p-1 text-center" colSpan={2}></td>
                <td className="border border-black p-1 text-center text-blue-700 text-xs">{reportData.totalPctKumulatif.toFixed(2)}%</td>
                <td className="border border-black p-1 text-center">-</td>
                <td className="border border-black p-1 text-center">-</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs">
            <div><p contentEditable suppressContentEditableWarning>Kontraktor Pelaksana</p><div className="h-16"></div><p className="font-bold border-b border-black inline-block px-8" contentEditable suppressContentEditableWarning>PT. SAKA GRAHA INDONESIA</p></div>
            <div><p contentEditable suppressContentEditableWarning>Konsultan Pengawas</p><div className="h-16"></div><p className="font-bold border-b border-black inline-block px-8" contentEditable suppressContentEditableWarning>PT. ELEMEN TIGA TIGA</p></div>
            <div><p contentEditable suppressContentEditableWarning>Disetujui Oleh, Pemilik Proyek (PPK)</p><div className="h-16"></div><p className="font-bold border-b border-black inline-block px-8" contentEditable suppressContentEditableWarning>( __________________ )</p></div>
          </div>
        </div>
      </div>
    </>
  );
}
