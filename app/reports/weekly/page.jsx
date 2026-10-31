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

  // State Teks yang Bisa Diedit (Standar PUPR)
  const [headerInfo, setHeaderInfo] = useState({
    namaPekerjaan: 'Pembangunan Gedung Kantor',
    lokasi: 'Surabaya',
    nomorKontrak: 'HK.02.03/XXX/2026',
    tanggalKontrak: '2026-01-01',
    tahunAnggaran: '2026',
    kontraktor: 'PT. SAKA GRAHA INDONESIA',
    konsultan: 'PT. ELEMEN TIGA TIGA',
    pemilik: 'Nama PPK / Pemilik Proyek',
    tanggalTtd: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    setLoading(true);
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

    const { data: pData } = await supabase.from('daily_progress').select('*');
    setRecords(pData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // --- KALKULASI LAPORAN ---
  const reportData = useMemo(() => {
    let totalRAB = 0;
    let totalRealisasiKumulatif = 0;

    tasks.filter(t => t.summary === 'No').forEach(t => { totalRAB += t.cost; });

    const rows = tasks.map(t => {
      const isSummary = t.summary === 'Yes';
      const taskRecords = records.filter(r => r.task_id === t.id);

      const volSdIni = taskRecords
        .filter(r => new Date(r.record_date) <= new Date(dateEnd))
        .reduce((sum, r) => sum + Number(r.completed_volume), 0);

      const volLalu = taskRecords
        .filter(r => new Date(r.record_date) <= new Date(prevDateEnd))
        .reduce((sum, r) => sum + Number(r.completed_volume), 0);

      const volMingguIni = taskRecords
        .filter(r => new Date(r.record_date) >= new Date(dateStart) && new Date(r.record_date) <= new Date(dateEnd))
        .reduce((sum, r) => sum + Number(r.completed_volume), 0);

      const pctKumulatif = t.volume > 0 ? Math.min((volSdIni / t.volume) * 100, 100) : 0;
      
      const bobot = totalRAB > 0 ? (t.cost / totalRAB) * 100 : 0;
      const bobotKumulatif = (pctKumulatif / 100) * bobot;
      const hargaSatuan = t.volume > 0 ? (t.cost / t.volume) : 0;

      if (!isSummary) {
        totalRealisasiKumulatif += (volSdIni * hargaSatuan);
      }

      return {
        ...t,
        isSummary,
        volSdIni,
        volLalu,
        volMingguIni,
        pctKumulatif,
        bobotKumulatif,
        hargaSatuan,
        totalHarga: t.cost
      };
    });

    const totalPctKumulatif = totalRAB > 0 ? (totalRealisasiKumulatif / totalRAB) * 100 : 0;
    const ppn = totalRealisasiKumulatif * 0.11;
    const grandTotal = totalRealisasiKumulatif + ppn;

    return { rows, totalRAB, totalRealisasiKumulatif, totalPctKumulatif, ppn, grandTotal };
  }, [tasks, records, dateStart, dateEnd, prevDateStart, prevDateEnd]);

  if (loading) return <LoadingSpinner text="Menyusun laporan..." />;

  return (
    <>
      {/* CSS Khusus untuk Print A4 */}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background-color: white !important; -webkit-print-color-adjust: exact; }
          .print-hidden { display: none !important; }
          .print-container { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: 100% !important; width: 100% !important; }
        }
      `}</style>

      <div className="p-8 bg-gray-100 min-h-screen overflow-x-auto print:p-0 print:bg-white">
        
        {/* Kontrol Periode (Sembunyi saat print) */}
        <div className="print-hidden mb-6 p-4 bg-white rounded-lg flex flex-wrap gap-4 items-end border border-gray-300 shadow-sm max-w-[210mm] mx-auto">
          <div>
            <label className="block text-xs font-bold mb-1 text-gray-700">Periode Minggu Ini (Mulai)</label>
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="border border-gray-300 p-1.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1 text-gray-700">Periode Minggu Ini (Selesai)</label>
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="border border-gray-300 p-1.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="border-l border-gray-300 pl-4">
            <label className="block text-xs font-bold mb-1 text-gray-700">Minggu Lalu (Mulai)</label>
            <input type="date" value={prevDateStart} onChange={e => setPrevDateStart(e.target.value)} className="border border-gray-300 p-1.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1 text-gray-700">Minggu Lalu (Selesai)</label>
            <input type="date" value={prevDateEnd} onChange={e => setPrevDateEnd(e.target.value)} className="border border-gray-300 p-1.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow font-bold hover:bg-blue-700 ml-auto transition-colors">
            🖨️ Cetak / Simpan PDF
          </button>
        </div>

        {/* --- KERTAS A4 --- */}
        <div className="print-container bg-white max-w-[210mm] min-h-[297mm] mx-auto p-8 shadow-xl border border-gray-300 text-black font-sans">
          
          {/* HEADER LAPORAN */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold uppercase underline decoration-2 underline-offset-4">Laporan Kemajuan Fisik Pekerjaan</h1>
            <h2 className="text-lg font-bold uppercase mt-1">Minggu Ini</h2>
          </div>

          {/* INFO HEADER (PUPR STYLE) */}
          <div className="flex justify-between mb-4 text-xs">
            <div className="space-y-1 w-3/5">
              <div className="grid grid-cols-[140px_10px_1fr] items-center">
                <span className="font-semibold">Nama Pekerjaan</span><span>:</span>
                <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50 px-1 font-bold text-sm">
                  {headerInfo.namaPekerjaan}
                </span>
              </div>
              <div className="grid grid-cols-[140px_10px_1fr] items-center">
                <span className="font-semibold">Lokasi</span><span>:</span>
                <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50 px-1">
                  {headerInfo.lokasi}
                </span>
              </div>
              <div className="grid grid-cols-[140px_10px_1fr] items-center">
                <span className="font-semibold">Nomor & Tanggal Kontrak</span><span>:</span>
                <span className="px-1">
                  <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50">{headerInfo.nomorKontrak}</span>
                  <span className="mx-2">Tanggal:</span>
                  <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50">{new Date(headerInfo.tanggalKontrak).toLocaleDateString('id-ID')}</span>
                </span>
              </div>
              <div className="grid grid-cols-[140px_10px_1fr] items-center">
                <span className="font-semibold">Kontraktor Pelaksana</span><span>:</span>
                <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50 px-1">
                  {headerInfo.kontraktor}
                </span>
              </div>
              <div className="grid grid-cols-[140px_10px_1fr] items-center">
                <span className="font-semibold">Tahun Anggaran</span><span>:</span>
                <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50 px-1">
                  {headerInfo.tahunAnggaran}
                </span>
              </div>
              <div className="grid grid-cols-[140px_10px_1fr] items-center">
                <span className="font-semibold">Nilai Kontrak</span><span>:</span>
                <span className="px-1 font-semibold">Rp {reportData.totalRAB.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-1 w-2/5 text-right flex flex-col justify-end">
               <div className="grid grid-cols-[130px_10px_1fr] items-center">
                 <span className="font-semibold">Periode Minggu Ini</span><span>:</span>
                 <span>{new Date(dateStart).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} s/d {new Date(dateEnd).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</span>
               </div>
               <div className="grid grid-cols-[130px_10px_1fr] items-center">
                 <span className="font-semibold">Periode Minggu Lalu</span><span>:</span>
                 <span>{new Date(prevDateStart).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} s/d {new Date(prevDateEnd).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</span>
               </div>
               <div className="grid grid-cols-[130px_10px_1fr] items-center bg-gray-100 p-1 border border-gray-400 mt-2">
                 <span className="font-bold">Progres s/d Laporan</span><span>:</span>
                 <span className="font-black text-blue-700 text-sm">{reportData.totalPctKumulatif.toFixed(2)}%</span>
               </div>
            </div>
          </div>

          {/* TABEL UTAMA */}
          <table className="w-full border-collapse border-2 border-black text-[10px]">
            <thead className="bg-[#d1d5db] text-black font-bold">
              <tr>
                <th className="border border-black p-1 w-8 text-center" rowSpan={2}>No.</th>
                <th className="border border-black p-1 text-left" rowSpan={2}>Uraian Pekerjaan</th>
                <th className="border border-black p-1 w-16 text-center" rowSpan={2}>Volume Kontrak</th>
                <th className="border border-black p-1 w-12 text-center" rowSpan={2}>Satuan</th>
                <th className="border border-black p-1 text-center" colSpan={4}>Kemajuan Fisik</th>
                <th className="border border-black p-1 w-24 text-right" rowSpan={2}>Harga Satuan (Rp)</th>
                <th className="border border-black p-1 w-28 text-right" rowSpan={2}>Jumlah Harga (Rp)</th>
              </tr>
              <tr>
                <th className="border border-black p-1 w-16 text-center">Minggu Lalu</th>
                <th className="border border-black p-1 w-16 text-center">Minggu Ini</th>
                <th className="border border-black p-1 w-16 text-center">s/d Minggu Ini</th>
                <th className="border border-black p-1 w-16 text-center">Bobot s/d Minggu Ini %</th>
              </tr>
            </thead>
            <tbody>
              {reportData.rows.map((row) => {
                const isSummary = row.isSummary;
                return (
                  <tr key={row.id} className={`${isSummary ? 'bg-gray-200 font-bold' : 'hover:bg-gray-50 even:bg-gray-50/50'}`}>
                    <td className="border border-black p-1 text-center">{row.wbs_code}</td>
                    <td className="border border-black p-1">{row.name}</td>
                    <td className="border border-black p-1 text-center">{isSummary ? '' : row.volume}</td>
                    <td className="border border-black p-1 text-center">{isSummary ? '' : row.satuan_hsd}</td>
                    <td className="border border-black p-1 text-center">{isSummary ? '' : row.volLalu.toFixed(2)}</td>
                    <td className="border border-black p-1 text-center">{isSummary ? '' : row.volMingguIni.toFixed(2)}</td>
                    <td className="border border-black p-1 text-center font-semibold">{isSummary ? '' : row.volSdIni.toFixed(2)}</td>
                    <td className="border border-black p-1 text-center font-bold text-blue-700">{isSummary ? '' : row.bobotKumulatif.toFixed(2) + '%'}</td>
                    <td className="border border-black p-1 text-right">{isSummary ? '' : `Rp ${row.hargaSatuan.toLocaleString('id-ID')}`}</td>
                    <td className="border border-black p-1 text-right font-semibold">{isSummary ? '' : `Rp ${row.totalHarga.toLocaleString('id-ID')}`}</td>
                  </tr>
                );
              })}
              
              {/* TOTAL ROW */}
              <tr className="bg-[#d1d5db] font-bold border-t-2 border-black">
                <td className="border border-black p-1.5 text-center" colSpan={9}>TOTAL KESELURUHAN</td>
                <td className="border border-black p-1.5 text-right text-blue-800 text-[11px]">Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>

          {/* FOOTER REKAPITULASI */}
          <div className="flex justify-between items-start mt-4">
            <div className="w-1/2 pt-2">
              <div className="inline-flex items-center gap-2 border border-black p-2 bg-gray-50 font-bold text-[11px]">
                <span>PROSENTASE KEMAJUAN FISIK :</span>
                <span>Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</span>
                <span>X 100% =</span>
                <span className="text-blue-700 text-sm">{reportData.totalPctKumulatif.toFixed(2)}%</span>
              </div>
            </div>
            
            <div className="w-5/12 text-[11px] grid grid-cols-[1fr_auto] border border-black">
              <div className="p-1 border-b border-r border-black font-semibold">TOTAL</div>
              <div className="p-1 border-b border-black text-right">Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</div>
              
              <div className="p-1 border-b border-r border-black font-semibold">PPN 11%</div>
              <div className="p-1 border-b border-black text-right">Rp {reportData.ppn.toLocaleString('id-ID')}</div>
              
              <div className="p-1 border-b border-r border-black font-semibold">JUMLAH</div>
              <div className="p-1 border-b border-black text-right">Rp {reportData.grandTotal.toLocaleString('id-ID')}</div>
              
              <div className="p-1 border-r border-black font-bold bg-gray-100">DIBULATKAN</div>
              <div className="p-1 text-right font-bold bg-gray-100">Rp {Math.round(reportData.grandTotal).toLocaleString('id-ID')}</div>
            </div>
          </div>

          {/* --- 3 KOLOM TANDA TANGAN --- */}
          <div className="mt-10 text-xs px-2">
            <div contentEditable suppressContentEditableWarning className="text-right mb-6 outline-none focus:bg-yellow-50 hover:bg-gray-50 w-fit ml-auto">
              {headerInfo.lokasi}, {new Date(headerInfo.tanggalTtd).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50">Kontraktor Pelaksana</p>
                <div className="h-20"></div>
                <div contentEditable suppressContentEditableWarning className="font-bold border-b border-black pb-1 outline-none focus:bg-yellow-50 hover:bg-gray-50 mx-2">
                  {headerInfo.kontraktor}
                </div>
              </div>

              <div>
                <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50">Konsultan Pengawas</p>
                <div className="h-20"></div>
                <div contentEditable suppressContentEditableWarning className="font-bold border-b border-black pb-1 outline-none focus:bg-yellow-50 hover:bg-gray-50 mx-2">
                  {headerInfo.konsultan}
                </div>
              </div>

              <div>
                <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50">Disetujui Oleh,</p>
                <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50">Pemilik Proyek (PPK)</p>
                <div className="h-16"></div>
                <div contentEditable suppressContentEditableWarning className="font-bold border-b border-black pb-1 outline-none focus:bg-yellow-50 hover:bg-gray-50 mx-2">
                  {headerInfo.pemilik}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
