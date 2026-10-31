'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function DailyReportPage() {
  const [loading, setLoading] = useState(true);
  const [projectInfo, setProjectInfo] = useState({});
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [progressData, setProgressData] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Ambil Info Project
    const { data: pData } = await supabase.from('projects').select('*').limit(1).maybeSingle();
    if (pData) setProjectInfo(pData);

    // 2. Ambil Progress Harian pada tanggal tersebut
    const { data: progData } = await supabase
      .from('daily_progress')
      .select(`completed_volume, wbs_tasks(name, wbs_code, ahsp_templates(unit))`)
      .eq('record_date', reportDate);

    if (progData) {
      setProgressData(progData.map(p => ({
        desc: `[${p.wbs_tasks?.wbs_code}] ${p.wbs_tasks?.name}`,
        unit: p.wbs_tasks?.ahsp_templates?.unit || '',
        vol: p.completed_volume
      })));
    } else {
      setProgressData([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [reportDate]);

  if (loading) return <LoadingSpinner text="Memuat Laporan Harian..." />;

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .print-hidden { display: none !important; }
          body { background-color: white !important; }
          .print-container { box-shadow: none !important; border: none !important; }
          .editable-area { background-color: transparent !important; border-bottom: 1px dashed #ccc !important; }
        }
      `}</style>

      <div className="p-8 bg-gray-100 min-h-screen overflow-x-auto print:p-0 print:bg-white">
        <div className="print-hidden mb-6 flex justify-between items-center max-w-[297mm] mx-auto bg-white p-3 rounded shadow">
          <div className="flex items-center gap-4">
            <label className="text-sm font-bold text-gray-700">Pilih Tanggal Laporan:</label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="border p-2 rounded text-sm" />
          </div>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-blue-700">🖨️ Cetak PDF</button>
        </div>

        <div className="print-container bg-white mx-auto p-6 shadow-xl border border-gray-300 text-xs text-black" style={{ width: '297mm', minHeight: '210mm' }}>
          <h1 className="text-center font-bold text-lg mb-4 uppercase">Laporan Harian Proyek Konstruksi</h1>
          
          <div className="flex justify-between mb-4">
            <div className="w-1/2 space-y-1">
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nama Paket Proyek</span><span>:</span><span className="editable-area border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>{projectInfo.name || 'Nama Proyek'}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Kontraktor Pelaksana</span><span>:</span><span className="editable-area border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>PT. Kontraktor (Edit)</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Konsultan Pengawas</span><span>:</span><span className="editable-area border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>PT. Konsultan (Edit)</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nomor Kontrak</span><span>:</span><span className="editable-area border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>{projectInfo.contract_number || 'HK.02.03/XXX/2026'}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nilai Kontrak</span><span>:</span><span className="px-1">Rp {(projectInfo.contract_value || 0).toLocaleString('id-ID')}</span></div>
            </div>
            <div className="w-1/2 space-y-1">
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Hari / Tanggal</span><span>:</span><span className="px-1">{new Date(reportDate).toLocaleDateString('id-ID', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Periode Kontrak</span><span>:</span><span className="px-1">{projectInfo.contract_start ? new Date(projectInfo.contract_start).toLocaleDateString('id-ID') : '-'} s.d {projectInfo.contract_end ? new Date(projectInfo.contract_end).toLocaleDateString('id-ID') : '-'}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Cuaca (Pagi)</span><span>:</span><span className="editable-area border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>Cerah</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Cuaca (Siang)</span><span>:</span><span className="editable-area border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>Cerah</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Cuaca (Sore)</span><span>:</span><span className="editable-area border-b border-dashed border-gray-400 px-1" contentEditable suppressContentEditableWarning>Hujan Ringan</span></div>
            </div>
          </div>

          <div className="font-bold mb-1 mt-4">A. TENAGA KERJA & PERALATAN (Isi Manual)</div>
          <div className="flex gap-4 mb-4">
            <div className="w-1/2">
              <table className="w-full border-collapse border border-black">
                <thead className="bg-gray-200"><tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Jenis Tenaga Kerja</th><th className="border border-black p-1 w-16">Jumlah</th></tr></thead>
                <tbody>
                  {[1,2,3].map(i => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i}</td>
                      <td className="border border-black p-1" contentEditable suppressContentEditableWarning></td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="w-1/2">
              <table className="w-full border-collapse border border-black">
                <thead className="bg-gray-200"><tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Jenis Alat</th><th className="border border-black p-1 w-16">Kapasitas</th><th className="border border-black p-1 w-16">Status</th><th className="border border-black p-1 w-12">Unit</th></tr></thead>
                <tbody>
                  {[1,2,3].map(i => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i}</td>
                      <td className="border border-black p-1" contentEditable suppressContentEditableWarning></td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning></td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning></td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="font-bold mb-1 mt-4">B. MATERIAL (Isi Manual) & PROGRESS FISIK HARIAN (Otomatis)</div>
          <div className="flex gap-4">
            <div className="w-1/2">
              <table className="w-full border-collapse border border-black">
                <thead className="bg-gray-200"><tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Material</th><th className="border border-black p-1 w-12">Satuan</th><th className="border border-black p-1 w-16">Vol Masuk</th><th className="border border-black p-1 w-16">Vol Pakai</th></tr></thead>
                <tbody>
                  {[1,2,3].map(i => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i}</td>
                      <td className="border border-black p-1" contentEditable suppressContentEditableWarning></td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning></td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning></td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="w-1/2">
              <table className="w-full border-collapse border border-black">
                <thead className="bg-gray-200"><tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Uraian Pekerjaan</th><th className="border border-black p-1 w-12">Satuan</th><th className="border border-black p-1 w-16">Vol Capaian</th></tr></thead>
                <tbody>
                  {progressData.map((p, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i+1}</td>
                      <td className="border border-black p-1">{p.desc}</td>
                      <td className="border border-black p-1 text-center">{p.unit}</td>
                      <td className="border border-black p-1 text-center font-bold">{p.vol}</td>
                    </tr>
                  ))}
                  {progressData.length === 0 && (
                    <tr><td colSpan={4} className="border border-black p-4 text-center italic text-gray-500">Belum ada input progres harian pada tanggal ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            <div><p contentEditable suppressContentEditableWarning>Diajukan Oleh, Kontraktor Pelaksana</p><div className="h-16"></div><p className="font-bold border-b border-black inline-block px-8" contentEditable suppressContentEditableWarning>PT. SAKA GRAHA INDONESIA</p></div>
            <div><p contentEditable suppressContentEditableWarning>Diperiksa Oleh, Konsultan Pengawas</p><div className="h-16"></div><p className="font-bold border-b border-black inline-block px-8" contentEditable suppressContentEditableWarning>PT. ELEMEN TIGA TIGA</p></div>
            <div><p contentEditable suppressContentEditableWarning>Disetujui Oleh, Direksi Pekerjaan / PPK</p><div className="h-16"></div><p className="font-bold border-b border-black inline-block px-8" contentEditable suppressContentEditableWarning>( __________________ )</p></div>
          </div>
        </div>
      </div>
    </>
  );
}
