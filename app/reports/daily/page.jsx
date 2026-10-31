'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Trash2 } from 'lucide-react';

export default function DailyReportPage() {
  const [formData, setFormData] = useState({
    namaProyek: 'Pembangunan Jalan Tol Cisumdawu',
    kontraktor: 'PT. SAKA GRAHA INDONESIA',
    konsultan: 'PT. ELEMEN TIGA TIGA',
    nomorKontrak: 'HK.02.03/XXX/2026',
    nilaiKontrak: 500000000,
    report_date: new Date().toISOString().split('T')[0],
    weather_morning: 'Cerah',
    weather_noon: 'Cerah',
    weather_afternoon: 'Hujan Ringan'
  });

  // State untuk baris dinamis
  const [manpower, setManpower] = useState([{ name: '', count: 1 }]);
  const [equipment, setEquipment] = useState([{ name: '', capacity: '', status: 'Operasi', count: 1 }]);
  const [materials, setMaterials] = useState([{ name: '', unit: '', inVol: 0, outVol: 0 }]);
  const [progressData, setProgressData] = useState([{ desc: '', unit: '', vol: 0 }]);

  const handleSave = async () => {
    try {
      const { error } = await supabase.from('daily_reports').insert([{
        report_date: formData.report_date,
        weather_morning: formData.weather_morning,
        weather_noon: formData.weather_noon,
        weather_afternoon: formData.weather_afternoon,
        manpower: manpower,
        equipment: equipment,
        materials: materials,
        progress_data: progressData
      }]);
      if (error) throw error;
      alert('Laporan Harian Berhasil Disimpan!');
    } catch (err) {
      alert('Gagal simpan: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .print-hidden { display: none !important; }
          body { background-color: white !important; }
          .print-container { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="p-8 bg-gray-100 min-h-screen overflow-x-auto print:p-0 print:bg-white">
        <div className="print-hidden mb-6 flex justify-end gap-4">
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">🖨️ Cetak PDF</button>
          <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700">💾 Simpan ke DB</button>
        </div>

        {/* KERTAS A4 LANDSCAPE */}
        <div className="print-container bg-white mx-auto p-6 shadow-xl border border-gray-300 text-xs text-black" style={{ width: '297mm', minHeight: '210mm' }}>
          
          <h1 className="text-center font-bold text-lg mb-4 uppercase">Laporan Harian Proyek Konstruksi</h1>
          
          {/* HEADER */}
          <div className="flex justify-between mb-4">
            <div className="w-1/2 space-y-1">
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nama Paket Proyek</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 px-1">{formData.namaProyek}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Kontraktor Pelaksana</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 px-1">{formData.kontraktor}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Konsultan Pengawas</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 px-1">{formData.konsultan}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nomor Kontrak</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 px-1">{formData.nomorKontrak}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nilai Kontrak</span><span>:</span><span className="px-1">Rp {formData.nilaiKontrak.toLocaleString('id-ID')}</span></div>
            </div>
            <div className="w-1/2 space-y-1">
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Hari / Tanggal</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 px-1">{new Date(formData.report_date).toLocaleDateString('id-ID', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Periode Kontrak</span><span>:</span><span>01 Jan 2026 s.d 31 Des 2026</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Cuaca (Pagi)</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 px-1">{formData.weather_morning}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Cuaca (Siang)</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 px-1">{formData.weather_noon}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Cuaca (Sore)</span><span>:</span><span contentEditable suppressContentEditableWarning className="border-b border-dashed border-gray-400 px-1">{formData.weather_afternoon}</span></div>
            </div>
          </div>

          {/* BAGIAN A: TENAGA KERJA & ALAT */}
          <div className="font-bold mb-1 mt-4">A. TENAGA KERJA & PERALATAN</div>
          <div className="flex gap-4 mb-4">
            {/* Tabel Tenaga Kerja */}
            <div className="w-1/2">
              <table className="w-full border-collapse border border-black">
                <thead className="bg-gray-200">
                  <tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Jenis Tenaga Kerja</th><th className="border border-black p-1 w-16">Jumlah</th></tr>
                </thead>
                <tbody>
                  {manpower.map((m, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i+1}</td>
                      <td className="border border-black p-1" contentEditable suppressContentEditableWarning>{m.name}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Tabel Peralatan */}
            <div className="w-1/2">
              <table className="w-full border-collapse border border-black">
                <thead className="bg-gray-200">
                  <tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Jenis Alat Berat</th><th className="border border-black p-1 w-16">Kapasitas</th><th className="border border-black p-1 w-16">Status</th><th className="border border-black p-1 w-12">Unit</th></tr>
                </thead>
                <tbody>
                  {equipment.map((e, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i+1}</td>
                      <td className="border border-black p-1" contentEditable suppressContentEditableWarning>{e.name}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{e.capacity}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{e.status}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BAGIAN B: MATERIAL & PROGRESS */}
          <div className="font-bold mb-1 mt-4">B. MATERIAL & PROGRESS FISIK HARIAN</div>
          <div className="flex gap-4">
            {/* Material */}
            <div className="w-1/2">
              <table className="w-full border-collapse border border-black">
                <thead className="bg-gray-200">
                  <tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Material</th><th className="border border-black p-1 w-12">Satuan</th><th className="border border-black p-1 w-16">Vol Masuk</th><th className="border border-black p-1 w-16">Vol Pakai</th></tr>
                </thead>
                <tbody>
                  {materials.map((mat, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i+1}</td>
                      <td className="border border-black p-1" contentEditable suppressContentEditableWarning>{mat.name}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{mat.unit}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{mat.inVol}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{mat.outVol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Progress Pekerjaan */}
            <div className="w-1/2">
              <table className="w-full border-collapse border border-black">
                <thead className="bg-gray-200">
                  <tr><th className="border border-black p-1 w-8">No</th><th className="border border-black p-1">Uraian Pekerjaan & Lokasi (STA)</th><th className="border border-black p-1 w-12">Satuan</th><th className="border border-black p-1 w-16">Vol Capaian</th></tr>
                </thead>
                <tbody>
                  {progressData.map((p, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i+1}</td>
                      <td className="border border-black p-1" contentEditable suppressContentEditableWarning>{p.desc}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{p.unit}</td>
                      <td className="border border-black p-1 text-center" contentEditable suppressContentEditableWarning>{p.vol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TANDA TANGAN */}
          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            <div>
              <p>Diajukan Oleh,</p><p className="mb-16">Kontraktor Pelaksana</p>
              <p className="font-bold border-b border-black inline-block px-8">{formData.kontraktor}</p>
            </div>
            <div>
              <p>Diperiksa Oleh,</p><p className="mb-16">Konsultan Pengawas</p>
              <p className="font-bold border-b border-black inline-block px-8">{formData.konsultan}</p>
            </div>
            <div>
              <p>Disetujui Oleh,</p><p className="mb-16">Direksi Pekerjaan / PPK</p>
              <p className="font-bold border-b border-black inline-block px-8">( __________________ )</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
