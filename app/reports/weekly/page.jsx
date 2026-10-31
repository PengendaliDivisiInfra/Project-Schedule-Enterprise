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

  // State Teks yang Bisa Diedit
  const [headerInfo, setHeaderInfo] = useState({
    namaPekerjaan: 'Proyek Konstruksi Enterprise',
    lokasi: 'Surabaya',
    kontraktor: 'PT. SAKA GRAHA INDONESIA',
    konsultan: 'PT. ELEMEN TIGA TIGA',
    pemilik: 'Nama PPK / Pemilik Proyek',
    nilaiKontrak: '0',
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
      const pctLalu = t.volume > 0 ? Math.min((volLalu / t.volume) * 100, 100) : 0;
      
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
        pctLalu,
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
    <div className="p-8 bg-white text-black font-sans min-h-screen overflow-x-auto print:p-0 print:overflow-visible">
      
      {/* Kontrol Periode (Sembunyi saat print) */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg flex flex-wrap gap-4 items-end print:hidden border border-gray-300 shadow-sm">
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

      {/* --- KERTAS LAPORAN --- */}
      <div className="max-w-[1200px] mx-auto print:max-w-full">
        
        {/* HEADER LAPORAN */}
        <div className="text-center mb-8 border-b-4 border-double border-black pb-4">
          <h1 className="text-2xl font-black uppercase tracking-wide">Laporan Kemajuan Fisik Pekerjaan</h1>
          <h2 className="text-xl font-bold uppercase mt-1">Minggu Ini</h2>
        </div>

        {/* INFO HEADER (Bisa Diedit) */}
        <div className="flex justify-between mb-6 text-sm">
          <div className="space-y-2 w-2/3">
            <div className="grid grid-cols-[160px_10px_1fr] items-center">
              <span className="font-semibold text-gray-600">Nama Pekerjaan</span><span>:</span>
              <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50 px-1 font-bold text-base">
                {headerInfo.namaPekerjaan}
              </span>
            </div>
            <div className="grid grid-cols-[160px_10px_1fr] items-center">
              <span className="font-semibold text-gray-600">Lokasi</span><span>:</span>
              <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50 px-1">
                {headerInfo.lokasi}
              </span>
            </div>
            <div className="grid grid-cols-[160px_10px_1fr] items-center">
              <span className="font-semibold text-gray-600">Kontraktor Pelaksana</span><span>:</span>
              <span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 outline-none focus:bg-yellow-50 hover:bg-gray-50 px-1">
                {headerInfo.kontraktor}
              </span>
            </div>
            <div className="grid grid-cols-[160px_10px_1fr] items-center">
              <span className="font-semibold text-gray-600">Nilai Kontrak</span><span>:</span>
              <span className="px-1 font-semibold">Rp {reportData.totalRAB.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="space-y-2 text-right w-1/3">
             <div className="grid grid-cols-[140px_10px_1fr] items-center">
               <span className="font-semibold text-gray-600">Periode Minggu Ini</span><span>:</span>
               <span>{new Date(dateStart).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} s/d {new Date(dateEnd).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</span>
             </div>
             <div className="grid grid-cols-[140px_10px_1fr] items-center">
               <span className="font-semibold text-gray-600">Periode Minggu Lalu</span><span>:</span>
               <span>{new Date(prevDateStart).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} s/d {new Date(prevDateEnd).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</span>
             </div>
             <div className="grid grid-cols-[140px_10px_1fr] items-center bg-gray-100 p-1 rounded border border-gray-300 mt-2">
               <span className="font-bold text-gray-800">Progres s/d Laporan</span><span>:</span>
               <span className="font-black text-blue-700 text-base">{reportData.totalPctKumulatif.toFixed(2)}%</span>
             </div>
          </div>
        </div>

        {/* TABEL UTAMA */}
        <table className="w-full border-collapse border-2 border-black text-xs font-sans">
          <thead className="bg-[#e5e7eb] text-black">
            <tr>
              <th className="border border-black p-1.5 w-10 text-center" rowSpan={2}>No.</th>
              <th className="border border-black p-1.5 text-left" rowSpan={2}>Uraian Pekerjaan</th>
              <th className="border border-black p-1.5 w-20 text-center" rowSpan={2}>Volume Kontrak</th>
              <th className="border border-black p-1.5 w-16 text-center" rowSpan={2}>Satuan</th>
              <th className="border border-black p-1.5 text-center" colSpan={4}>Kemajuan Fisik</th>
              <th className="border border-black p-1.5 w-28 text-right" rowSpan={2}>Harga Satuan (Rp)</th>
              <th className="border border-black p-1.5 w-32 text-right" rowSpan={2}>Jumlah Harga (Rp)</th>
            </tr>
            <tr>
              <th className="border border-black p-1.5 w-20 text-center">Minggu Lalu</th>
              <th className="border border-black p-1.5 w-20 text-center">Minggu Ini</th>
              <th className="border border-black p-1.5 w-20 text-center">s/d Minggu Ini</th>
              <th className="border border-black p-1.5 w-20 text-center">Bobot s/d Minggu Ini %</th>
            </tr>
          </thead>
          <tbody>
            {reportData.rows.map((row) => {
              const isSummary = row.isSummary;
              return (
                <tr key={row.id} className={`${isSummary ? 'bg-gray-200 font-bold' : 'hover:bg-blue-50 even:bg-gray-50'} transition-colors`}>
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
            <tr className="bg-[#e5e7eb] font-bold border-t-2 border-black">
              <td className="border border-black p-2 text-center" colSpan={9}>TOTAL KESELURUHAN</td>
              <td className="border border-black p-2 text-right text-blue-800 text-sm">Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>

        {/* FOOTER REKAPITULASI */}
        <div className="flex justify-between items-start mt-6">
          <div className="w-1/2 pt-2">
            <div className="inline-flex items-center gap-2 border border-black p-2 bg-gray-50 font-bold text-sm">
              <span>PROSENTASE KEMAJUAN FISIK :</span>
              <span>Rp {reportData.totalRealisasiKumulatif.toLocaleString('id-ID')}</span>
              <span>X 100% =</span>
              <span className="text-blue-700 text-lg">{reportData.totalPctKumulatif.toFixed(2)}%</span>
            </div>
          </div>
          
          <div className="w-1/3 text-sm grid grid-cols-[1fr_auto] border border-black">
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
        <div className="mt-16 text-sm px-4">
          <div className="text-right mb-4" contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50 w-fit ml-auto">
            {headerInfo.lokasi}, {new Date(headerInfo.tanggalTtd).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}
          </div>

          <div className="grid grid-cols-3 gap-8 text-center">
            {/* KOLOM 1: KONTRAKTOR */}
            <div>
              <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50">Kontraktor Pelaksana</p>
              <div className="h-24"></div> {/* Spasi TTD */}
              <div contentEditable suppressContentEditableWarning className="font-bold border-b border-black pb-1 outline-none focus:bg-yellow-50 hover:bg-gray-50 mx-4 print:border-black">
                {headerInfo.kontraktor}
              </div>
            </div>

            {/* KOLOM 2: KONSULTAN (BARU) */}
            <div>
              <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50">Konsultan Pengawas</p>
              <div className="h-24"></div> {/* Spasi TTD */}
              <div contentEditable suppressContentEditableWarning className="font-bold border-b border-black pb-1 outline-none focus:bg-yellow-50 hover:bg-gray-50 mx-4 print:border-black">
                {headerInfo.konsultan}
              </div>
            </div>

            {/* KOLOM 3: PEMILIK PROYEK (BARU) */}
            <div>
              <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50">Disetujui Oleh,</p>
              <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50 hover:bg-gray-50">Pemilik Proyek (PPK)</p>
              <div className="h-20"></div> {/* Spasi TTD lebih kecil karena ada 2 baris judul */}
              <div contentEditable suppressContentEditableWarning className="font-bold border-b border-black pb-1 outline-none focus:bg-yellow-50 hover:bg-gray-50 mx-4 print:border-black">
                {headerInfo.pemilik}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
