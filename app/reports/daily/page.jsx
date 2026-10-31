'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function DailyReportPage() {
  const [projectInfo, setProjectInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchProjectData = async () => {
      // Mengambil data dari tabel projects (asumsi 1 proyek aktif per database)
      const { data, error } = await supabase.from('projects').select('*').limit(1).maybeSingle();
      if (data) {
        setProjectInfo(data);
      }
      setLoading(false);
    };
    fetchProjectData();
  }, []);

  if (loading) return <LoadingSpinner text="Memuat data proyek..." />;

  // Format tanggal untuk header
  const formattedDate = new Date(reportDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  // Format periode kontrak
  const startDate = projectInfo.contract_start ? new Date(projectInfo.contract_start).toLocaleDateString('id-ID') : '-';
  const endDate = projectInfo.contract_end ? new Date(projectInfo.contract_end).toLocaleDateString('id-ID') : '-';

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      
      {/* Kontrol Atas */}
      <div className="mb-4 flex justify-between items-center max-w-[210mm] mx-auto bg-white p-3 rounded shadow print:hidden">
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold">Tanggal:</label>
          <input 
            type="date" 
            value={reportDate} 
            onChange={(e) => setReportDate(e.target.value)} 
            className="border p-1 text-sm rounded" 
          />
        </div>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-blue-700">
          🖨️ Cetak PDF
        </button>
      </div>

      {/* Kertas Laporan (A4) */}
      <div className="print-container bg-white mx-auto p-8 shadow-xl border border-gray-300 text-[11px] text-black" style={{ width: '210mm', minHeight: '297mm' }}>
        
        <h1 className="text-center font-bold text-lg mb-4 uppercase">LAPORAN HARIAN PROYEK KONSTRUKSI</h1>
        
        {/* Header Info Proyek */}
        <div className="mb-6 border-b-2 border-black pb-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="grid grid-cols-[140px_10px_1fr]"><span>Nama Paket Proyek</span><span>:</span><span className="font-bold">{projectInfo.name || '-'}</span></div>
              <div className="grid grid-cols-[140px_10px_1fr]"><span>Kontraktor Pelaksana</span><span>:</span><span>{projectInfo.contractor_name || '-'}</span></div>
              <div className="grid grid-cols-[140px_10px_1fr]"><span>Konsultan Pengawas</span><span>:</span><span>{projectInfo.consultant_name || '-'}</span></div>
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Hari / Tanggal</span><span>:</span><span>{formattedDate}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Periode Kontrak</span><span>:</span><span>{startDate} s.d {endDate}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nomor Kontrak</span><span>:</span><span>{projectInfo.contract_number || '-'}</span></div>
              <div className="grid grid-cols-[120px_10px_1fr]"><span>Nilai Kontrak</span><span>:</span><span>Rp {Number(projectInfo.contract_value || 0).toLocaleString('id-ID')}</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
             <div className="grid grid-cols-[140px_10px_1fr]"><span>Cuaca (Pagi/Siang/Sore)</span><span>:</span><span>Cerah / Cerah / Hujan Ringan</span></div>
          </div>
        </div>

        {/* A. TENAGA KERJA */}
        <div className="mb-4">
          <h2 className="font-bold mb-1">A. TENAGA KERJA</h2>
          <table className="w-full border-collapse border border-black">
            <thead className="bg-gray-200 text-center">
              <tr>
                <th className="border border-black p-1 w-10">No</th>
                <th className="border border-black p-1">Jenis Tenaga Kerja</th>
                <th className="border border-black p-1 w-20">Jumlah</th>
                <th className="border border-black p-1 w-12 print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-1 text-center">1</td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1 text-center">1</td>
                <td className="border border-black p-1 text-center print:hidden text-red-500 cursor-pointer">🗑️</td>
              </tr>
            </tbody>
          </table>
          <div className="text-right mt-1 print:hidden"><button className="text-blue-600 hover:underline">+ Tambah Baris</button></div>
        </div>

        {/* B. PERALATAN */}
        <div className="mb-4">
          <h2 className="font-bold mb-1">B. PERALATAN</h2>
          <table className="w-full border-collapse border border-black">
            <thead className="bg-gray-200 text-center">
              <tr>
                <th className="border border-black p-1 w-10">No</th>
                <th className="border border-black p-1">Jenis Alat</th>
                <th className="border border-black p-1 w-24">Kapasitas</th>
                <th className="border border-black p-1 w-20">Status</th>
                <th className="border border-black p-1 w-16">Unit</th>
                <th className="border border-black p-1 w-12 print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-1 text-center">1</td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1 text-center">Operasi</td>
                <td className="border border-black p-1 text-center">1</td>
                <td className="border border-black p-1 text-center print:hidden text-red-500 cursor-pointer">🗑️</td>
              </tr>
            </tbody>
          </table>
          <div className="text-right mt-1 print:hidden"><button className="text-blue-600 hover:underline">+ Tambah Baris</button></div>
        </div>

        {/* C. MATERIAL */}
        <div className="mb-4">
          <h2 className="font-bold mb-1">C. MATERIAL</h2>
          <table className="w-full border-collapse border border-black">
            <thead className="bg-gray-200 text-center">
              <tr>
                <th className="border border-black p-1 w-10">No</th>
                <th className="border border-black p-1">Material</th>
                <th className="border border-black p-1 w-20">Satuan</th>
                <th className="border border-black p-1 w-24">Vol Masuk</th>
                <th className="border border-black p-1 w-24">Vol Pakai</th>
                <th className="border border-black p-1 w-12 print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-1 text-center">1</td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1 text-center">0</td>
                <td className="border border-black p-1 text-center">0</td>
                <td className="border border-black p-1 text-center print:hidden text-red-500 cursor-pointer">🗑️</td>
              </tr>
            </tbody>
          </table>
          <div className="text-right mt-1 print:hidden"><button className="text-blue-600 hover:underline">+ Tambah Baris</button></div>
        </div>

        {/* D. PROGRESS FISIK HARIAN */}
        <div className="mb-8">
          <h2 className="font-bold mb-1">D. PROGRESS FISIK HARIAN</h2>
          <table className="w-full border-collapse border border-black">
            <thead className="bg-gray-200 text-center">
              <tr>
                <th className="border border-black p-1 w-10">No</th>
                <th className="border border-black p-1">Uraian Pekerjaan</th>
                <th className="border border-black p-1 w-20">Satuan</th>
                <th className="border border-black p-1 w-24">Vol Capaian</th>
                <th className="border border-black p-1 w-12 print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-1 text-center">1</td>
                <td className="border border-black p-1">[1.1] Mobilisasi Alat</td>
                <td className="border border-black p-1 text-center">LS</td>
                <td className="border border-black p-1 text-center">0,5</td>
                <td className="border border-black p-1 text-center print:hidden text-red-500 cursor-pointer">🗑️</td>
              </tr>
            </tbody>
          </table>
          <div className="text-right mt-1 print:hidden"><button className="text-blue-600 hover:underline">+ Tambah Baris</button></div>
        </div>

        {/* Tanda Tangan */}
        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div>
            <p>Diajukan Oleh, Kontraktor Pelaksana</p>
            <div className="h-20"></div>
            <p className="font-bold border-b border-black inline-block px-8 uppercase">{projectInfo.contractor_name || 'PT. SAKA GRAHA INDONESIA'}</p>
          </div>
          <div>
            <p>Diperiksa Oleh, Konsultan Pengawas</p>
            <div className="h-20"></div>
            <p className="font-bold border-b border-black inline-block px-8 uppercase">{projectInfo.consultant_name || 'PT. ELEMEN TIGA TIGA'}</p>
          </div>
          <div>
            <p>Disetujui Oleh, Direksi Pekerjaan / PPK</p>
            <div className="h-20"></div>
            <p className="font-bold border-b border-black inline-block px-8 uppercase">{projectInfo.ppk_name || '( ......................... )'}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
