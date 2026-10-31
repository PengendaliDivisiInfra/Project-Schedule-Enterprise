'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Trash2 } from 'lucide-react';

export default function DailyReportPage() {
  const [projectInfo, setProjectInfo] = useState({});
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  
  // State Dinamis
  const [manpower, setManpower] = useState([{ name: '', count: 1 }]);
  const [equipment, setEquipment] = useState([{ name: '', capacity: '', status: 'Operasi', count: 1 }]);
  const [materials, setMaterials] = useState([{ name: '', unit: '', inVol: 0, outVol: 0 }]);
  const [progressData, setProgressData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const { data: pData } = await supabase.from('projects').select('*').limit(1).maybeSingle();
      if (pData) setProjectInfo(pData);

      const { data: progData } = await supabase
        .from('daily_progress')
        .select(`completed_volume, wbs_tasks(name, wbs_code, ahsp_templates(unit))`)
        .eq('record_date', reportDate);

      if (progData && progData.length > 0) {
        setProgressData(progData.map(p => ({
          desc: `[${p.wbs_tasks?.wbs_code}] ${p.wbs_tasks?.name}`,
          unit: p.wbs_tasks?.ahsp_templates?.unit || '',
          vol: p.completed_volume
        })));
      } else {
        setProgressData([{ desc: '', unit: '', vol: 0 }]); // Beri 1 baris kosong
      }
    }
    fetchData();
  }, [reportDate]);

  // Handlers untuk Tambah/Hapus Baris
  const addRow = (setter, template) => setter(prev => [...prev, template]);
  const removeRow = (setter, index) => setter(prev => prev.filter((_, i) => i !== index));
  const updateRow = (setter, index, field, value) => {
    setter(prev => {
      const newRows = [...prev];
      newRows[index] = { ...newRows[index], [field]: value };
      return newRows;
    });
  };

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
            <label className="text-sm font-bold text-gray-700">Tanggal:</label>
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

          {/* TENAGA KERJA */}
          <div className="font-bold mb-1 mt-4 flex justify-between items-center">
            <span>A. TENAGA KERJA</span>
            <button onClick={() => addRow(setManpower, { name: '', count: 1 })} className="print-hidden text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12}/> Tambah Baris</button>
          </div>
          <table className="w-full border-collapse border border-black mb-4">
            <thead className="bg-gray-200"><tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Jenis Tenaga Kerja</th><th className="border border-black p-1 w-16">Jumlah</th><th className="border border-black p-1 w-10 print-hidden">Aksi</th></tr></thead>
            <tbody>
              {manpower.map((m, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">{i+1}</td>
                  <td className="border border-black p-1"><input value={m.name} onChange={e => updateRow(setManpower, i, 'name', e.target.value)} className="w-full outline-none bg-transparent" /></td>
                  <td className="border border-black p-1 text-center"><input type="number" value={m.count} onChange={e => updateRow(setManpower, i, 'count', e.target.value)} className="w-full outline-none bg-transparent text-center" /></td>
                  <td className="border border-black p-1 text-center print-hidden"><button onClick={() => removeRow(setManpower, i)} className="text-red-500 hover:text-red-700"><Trash2 size={12}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PERALATAN */}
          <div className="font-bold mb-1 mt-4 flex justify-between items-center">
            <span>B. PERALATAN</span>
            <button onClick={() => addRow(setEquipment, { name: '', capacity: '', status: 'Operasi', count: 1 })} className="print-hidden text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12}/> Tambah Baris</button>
          </div>
          <table className="w-full border-collapse border border-black mb-4">
            <thead className="bg-gray-200"><tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Jenis Alat</th><th className="border border-black p-1 w-20">Kapasitas</th><th className="border border-black p-1 w-24">Status</th><th className="border border-black p-1 w-16">Unit</th><th className="border border-black p-1 w-10 print-hidden">Aksi</th></tr></thead>
            <tbody>
              {equipment.map((eq, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">{i+1}</td>
                  <td className="border border-black p-1"><input value={eq.name} onChange={e => updateRow(setEquipment, i, 'name', e.target.value)} className="w-full outline-none bg-transparent" /></td>
                  <td className="border border-black p-1 text-center"><input value={eq.capacity} onChange={e => updateRow(setEquipment, i, 'capacity', e.target.value)} className="w-full outline-none bg-transparent text-center" /></td>
                  <td className="border border-black p-1 text-center"><input value={eq.status} onChange={e => updateRow(setEquipment, i, 'status', e.target.value)} className="w-full outline-none bg-transparent text-center" /></td>
                  <td className="border border-black p-1 text-center"><input type="number" value={eq.count} onChange={e => updateRow(setEquipment, i, 'count', e.target.value)} className="w-full outline-none bg-transparent text-center" /></td>
                  <td className="border border-black p-1 text-center print-hidden"><button onClick={() => removeRow(setEquipment, i)} className="text-red-500 hover:text-red-700"><Trash2 size={12}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* MATERIAL */}
          <div className="font-bold mb-1 mt-4 flex justify-between items-center">
            <span>C. MATERIAL</span>
            <button onClick={() => addRow(setMaterials, { name: '', unit: '', inVol: 0, outVol: 0 })} className="print-hidden text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12}/> Tambah Baris</button>
          </div>
          <table className="w-full border-collapse border border-black mb-4">
            <thead className="bg-gray-200"><tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Material</th><th className="border border-black p-1 w-16">Satuan</th><th className="border border-black p-1 w-20">Vol Masuk</th><th className="border border-black p-1 w-20">Vol Pakai</th><th className="border border-black p-1 w-10 print-hidden">Aksi</th></tr></thead>
            <tbody>
              {materials.map((mat, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">{i+1}</td>
                  <td className="border border-black p-1"><input value={mat.name} onChange={e => updateRow(setMaterials, i, 'name', e.target.value)} className="w-full outline-none bg-transparent" /></td>
                  <td className="border border-black p-1 text-center"><input value={mat.unit} onChange={e => updateRow(setMaterials, i, 'unit', e.target.value)} className="w-full outline-none bg-transparent text-center" /></td>
                  <td className="border border-black p-1 text-center"><input type="number" value={mat.inVol} onChange={e => updateRow(setMaterials, i, 'inVol', e.target.value)} className="w-full outline-none bg-transparent text-center" /></td>
                  <td className="border border-black p-1 text-center"><input type="number" value={mat.outVol} onChange={e => updateRow(setMaterials, i, 'outVol', e.target.value)} className="w-full outline-none bg-transparent text-center" /></td>
                  <td className="border border-black p-1 text-center print-hidden"><button onClick={() => removeRow(setMaterials, i)} className="text-red-500 hover:text-red-700"><Trash2 size={12}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PROGRESS FISIK */}
          <div className="font-bold mb-1 mt-4 flex justify-between items-center">
            <span>D. PROGRESS FISIK HARIAN</span>
            <button onClick={() => addRow(setProgressData, { desc: '', unit: '', vol: 0 })} className="print-hidden text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12}/> Tambah Baris</button>
          </div>
          <table className="w-full border-collapse border border-black">
            <thead className="bg-gray-200"><tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Uraian Pekerjaan</th><th className="border border-black p-1 w-16">Satuan</th><th className="border border-black p-1 w-20">Vol Capaian</th><th className="border border-black p-1 w-10 print-hidden">Aksi</th></tr></thead>
            <tbody>
              {progressData.map((p, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">{i+1}</td>
                  <td className="border border-black p-1"><input value={p.desc} onChange={e => updateRow(setProgressData, i, 'desc', e.target.value)} className="w-full outline-none bg-transparent" /></td>
                  <td className="border border-black p-1 text-center"><input value={p.unit} onChange={e => updateRow(setProgressData, i, 'unit', e.target.value)} className="w-full outline-none bg-transparent text-center" /></td>
                  <td className="border border-black p-1 text-center"><input type="number" value={p.vol} onChange={e => updateRow(setProgressData, i, 'vol', e.target.value)} className="w-full outline-none bg-transparent text-center font-bold" /></td>
                  <td className="border border-black p-1 text-center print-hidden"><button onClick={() => removeRow(setProgressData, i)} className="text-red-500 hover:text-red-700"><Trash2 size={12}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>

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
