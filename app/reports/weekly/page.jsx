'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function WeeklyReportPage() {
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Periode Laporan
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);

  const [dateStart, setDateStart] = useState(lastWeek.toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(today.toISOString().split('T')[0]);
  const [prevDateStart, setPrevDateStart] = useState(twoWeeksAgo.toISOString().split('T')[0]);
  const [prevDateEnd, setPrevDateEnd] = useState(lastWeek.toISOString().split('T')[0]);

  // State Signatures (Editable)
  const [signatures, setSignatures] = useState({
    kontraktor: 'PT. SAKA GRAHA INDONESIA',
    konsultan: 'PT. ELEMEN TIGA TIGA',
    lokasi: 'Surabaya',
    tanggalTtd: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    setLoading(true);
    // Fetch Tasks
    const { data: tData } = await supabase
      .from('wbs_tasks')
      .select(`id, name, wbs_code, summary, volume, cost, ahsp_templates(unit)`)
      .order('wbs_code');
    
    if (tData) {
      const uniqueTasks = Array.from(new Map(tData.map(item => [item.wbs_code, item])).values());
      setTasks(uniqueTasks.map(t => ({
        ...t,
        satuan_hsd: t.ahsp_templates?.unit || 'unit',
        volume: Number(t.volume) || 0,
        cost: Number(t.cost) || 0
      })));
    }

    // Fetch All Progress
    const { data: pData } = await supabase.from('daily_progress').select('*');
    setRecords(pData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // --- KALKULASI LAPORAN ---
  const reportData = useMemo(() => {
    let totalRAB = 0;
    let totalRealisasiKumulatif = 0;
    let totalVolumeMingguIni = 0;
    let totalVolumeMingguLalu = 0;

    // 1. Hitung Total RAB (Hanya Leaf Task)
    tasks.filter(t => t.summary === 'No').forEach(t => { totalRAB += t.cost; });

    const rows = tasks.map(t => {
      const isSummary = t.summary === 'Yes';
      const taskRecords = records.filter(r => r.task_id === t.id);

      // Volume Kumulatif s/d Minggu Ini
      const volSdIni = taskRecords
        .filter(r => new Date(r.record_date) <= new Date(dateEnd))
        .reduce((sum, r) => sum + Number(r.completed_volume), 0);

      // Volume s/d Minggu Lalu
      const volLalu = taskRecords
        .filter(r => new Date(r.record_date) <= new Date(prevDateEnd))
        .reduce((sum, r) => sum + Number(r.completed_volume), 0);

      // Volume Minggu Ini
      const volMingguIni = taskRecords
        .filter(r => new Date(r.record_date) >= new Date(dateStart) && new Date(r.record_date) <= new Date(dateEnd))
        .reduce((sum, r) => sum + Number(r.completed_volume), 0);

      // Persentase Progres
      const pctKumulatif = t.volume > 0 ? Math.min((volSdIni / t.volume) * 100, 100) : 0;
      const pctLalu = t.volume > 0 ? Math.min((volLalu / t.volume) * 100, 100) : 0;
      
      // Bobot & Uang
      const bobot = totalRAB > 0 ? (t.cost / totalRAB) * 100 : 0;
      const bobotKumulatif = (pctKumulatif / 100) * bobot;
      const totalHarga = t.volume * (t.volume > 0 ? (t.cost / t.volume) : 0); // Jika cost sudah total, ini hanya safety
      const hargaSatuan = t.volume > 0 ? (t.cost / t.volume) : 0;

      // Akumulasi Global (Hanya Leaf)
      if (!isSummary) {
        totalRealisasiKumulatif += (volSdIni * hargaSatuan);
        totalVolumeMingguIni += volMingguIni;
        totalVolumeMingguLalu += volLalu;
      }

      return {
        ...t,
        isSummary,
        volSdIni,
        volLalu,
        volMingguIni,
        pctKumulatif,
        pctLalu,
        bobotKumulatif,
        hargaSatuan,
        totalHarga: t.cost // Total Harga RAB
      };
    });

    // Hitung Total Rencana & Deviasi (Disederhanakan untuk demo, menggunakan total RAB)
    const totalPctKumulatif = totalRAB > 0 ? (totalRealisasiKumulatif / totalRAB) * 100 : 0;
    const ppn = totalRealisasiKumulatif * 0.11;
    const grandTotal = totalRealisasiKumulatif + ppn;

    return {
      rows,
      totalRAB,
      totalRealisasiKumulatif,
      totalPctKumulatif,
      ppn,
      grandTotal,
      totalVolumeMingguIni,
      totalVolumeMingguLalu
    };
  }, [tasks, records, dateStart, dateEnd, prevDateStart, prevDateEnd]);

  if (loading) return <LoadingSpinner text="Menyusun laporan..." />;

  return (
    <div className="p-8 bg-white text-black font-sans min-h-screen overflow-x-auto print:p-0 print:overflow-visible">
      
      {/* Kontrol Periode & Print (Sembunyi saat dicetak) */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg flex flex-wrap gap-4 items-end print:hidden">
        <div>
          <label className="block text-xs font-bold mb-1">Periode Minggu Ini (Mulai)</label>
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="border p-1 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Periode Minggu Ini (Selesai)</label>
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="border p-1 rounded text-sm" />
        </div>
        <div className="border-l pl-4">
          <label className="block text-xs font-bold mb-1">Minggu Lalu (Mulai)</label>
          <input type="date" value={prevDateStart} onChange={e => setPrevDateStart(e.target.value)} className="border p-1 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Minggu Lalu (Selesai)</label>
          <input type="date" value={prevDateEnd} onChange={e => setPrevDateEnd(e.target.value)} className="border p-1 rounded text-sm" />
        </div>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded shadow font-bold hover:bg-blue-700 ml-auto">
          🖨️ Cetak / Simpan PDF
        </button>
      </div>

      {/* HEADER LAPORAN */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold uppercase">Laporan Kemajuan Fisik Pekerjaan</h1>
        <h2 className="text-lg font-bold uppercase">Minggu Ini</h2>
      </div>

      <div className="flex justify-between mb-6 text-sm">
        <div className="space-y-1">
          <div className="grid grid-cols-[150px_10px_1fr]"><span>Nama Pekerjaan</span><span>:</span><span>Proyek Konstruksi Enterprise</span></div>
          <div className="grid grid-cols-[150px_10px_1fr]"><span>Lokasi</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none">{signatures.lokasi}</span></div>
          <div className="grid grid-cols-[150px_10px_1fr]"><span>Kontraktor Pelaksana</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none">{signatures.kontraktor}</span></div>
          <div className="grid grid-cols-[150px_10px_1fr]"><span>Nilai Kontrak</span><span>:</span><span>Rp {reportData.totalRAB.toLocaleString('id-ID')}</span></div>
        </div>
        <div className="space-y-1 text-right">
           <div className="grid grid-cols-[200px_10px_1fr]"><span>Periode Minggu Ini</span><span>:</span><span>{new Date(dateStart).toLocaleDateString('id-ID')} s/d {new Date(dateEnd).toLocaleDateString('id-ID')}</span></div>
           <div className="grid grid-cols-[200px_10px_1fr]"><span>Periode Minggu Lalu</span><span>:</span><span>{new Date(prevDateStart).toLocaleDateString('id-ID')} s/d {new Date(prevDateEnd).toLocaleDateString('id-ID')}</span></div>
           <div className="grid grid-cols-[200px_10px_1fr] font-bold mt-2"><span>Prosentase s/d Laporan Dibuat</span><span>:</span><span>{reportData.totalPctKumulatif.toFixed(2)}%</span></div>
        </div>
      </div>

      {/* TABEL UTAMA */}
      <table className="w-full border-collapse border border-black text-xs">
        <thead className="bg-[#d9d9d9]">
          <tr>
            <th className="border border-black p-1 w-8" rowSpan={2}>No.</th>
            <th className="border border-black p-1 text-left" rowSpan={2}>Uraian Pekerjaan</th>
            <th className="border border-black p-1 w-16" rowSpan={2}>Volume Kontrak</th>
            <th className="border border-black p-1 w-12" rowSpan={2}>Satuan</th>
            <th className="border border-black p-1" colSpan={4}>Kemajuan Fisik</th>
            <th className="border border-black p-1 w-24" rowSpan={2}>Harga Satuan</th>
            <th className="border border-black p-1 w-28" rowSpan={2}>Jumlah Harga</th>
          </tr>
          <tr>
            <th className="border border-black p-1 w-16">Minggu Lalu</th>
            <th className="border border-black p-1 w-16">Minggu Ini</th>
            <th className="border border-black p-1 w-16">s/d Minggu Ini</th>
            <th className="border border-black p-1 w-16">Bobot s/d Minggu Ini %</th>
          </tr>
        </thead>
        <tbody>
          {reportData.rows.map((row, idx) => {
            const isSummary = row.isSummary;
            return (
              <tr key={row.id} className={isSummary ? 'bg-[#f2f2f2] font-bold' : ''}>
                <td className="border border-black p-1 text-center">{row.wbs_code}</td>
                <td className="border border-black p-1">{row.name}</td>
                <td className="border border-black p-1 text-center">{isSummary ? '' : row.volume}</td>
                <td className="border border-black p-1 text-center">{isSummary ? '' : row.satuan_hsd}</td>
                <td className="border border-black p-1 text-center">{isSummary ? '' : row.volLalu.toFixed(2)}</td>
                <td className="border border-black p-1 text-center">{isSummary ? '' : row.volMingguIni.toFixed(2)}</td>
                <td className="border border-black p-1 text-center">{isSummary ? '' : row.volSdIni.toFixed(2)}</td>
                <td className="border border-black p-1 text-center">{isSummary ? '' : row.bobotKumulatif.toFixed(2) + '%'}</td>
                <td className="border border-black p-1 text-right">{isSummary ? '' : `Rp ${row.hargaSatuan.toLocaleString('id-ID')}`}</td>
                <td className="border border-black p-1 text-right">{isSummary ? '' : `Rp ${row.totalHarga.toLocaleString('id-ID')}`}</td>
              </tr>
            );
          })}
          
          {/* TOTAL ROW */}
          <tr className="bg-[#d9d9d9] font-bold">
            <td className="border border-black p-1 text-center" colSpan={7}>TOTAL</td>
            <td className="border border-black p-1 text-center">Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</td>
            <td className="border border-black p-1 text-right">Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>

      {/* FOOTER REKAPITULASI (PPN & PEMBULATAN) */}
      <div className="flex justify-end mt-4">
        <div className="w-1/2 text-sm grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <span className="font-bold">TOTAL</span>
          <span className="text-right font-bold">Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</span>
          
          <span className="font-bold">PPN 11%</span>
          <span className="text-right">Rp {reportData.ppn.toLocaleString('id-ID')}</span>
          
          <span className="font-bold">JUMLAH</span>
          <span className="text-right">Rp {reportData.grandTotal.toLocaleString('id-ID')}</span>
          
          <span className="font-bold">DIBULATKAN</span>
          <span className="text-right border-t border-black pt-1 font-bold">Rp {Math.round(reportData.grandTotal).toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div className="mt-6 flex justify-center text-sm font-bold">
        <div className="flex items-center gap-4">
          <span>PROSENTASE KEMAJUAN FISIK :</span>
          <span>Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</span>
          <span>X</span>
          <span>100%</span>
          <span>=</span>
          <span>{reportData.totalPctKumulatif.toFixed(2)}%</span>
        </div>
      </div>

      {/* TANDA TANGAN (EDITABLE) */}
      <div className="mt-16 flex justify-between text-sm px-10">
        <div className="text-center w-64">
          <p>Kontraktor Pelaksana</p>
          <div contentEditable suppressContentEditableWarning className="font-bold mt-20 border-b border-black pb-1 outline-none focus:bg-yellow-50 hover:bg-gray-50 print:border-black">PT. SAKA GRAHA INDONESIA</div>
        </div>
        <div className="text-center w-64">
          <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50 print:border-none">{signatures.lokasi}, {new Date(signatures.tanggalTtd).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
          <p className="mt-1">Konsultan Pengawas</p>
          <div contentEditable suppressContentEditableWarning className="font-bold mt-16 border-b border-black pb-1 outline-none focus:bg-yellow-50 hover:bg-gray-50 print:border-black">PT. ELEMEN TIGA TIGA</div>
        </div>
      </div>

    </div>
  );
}
