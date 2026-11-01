'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import AssignmentModal from '../../components/AssignmentModal';
import { Plus, Printer, Trash2 } from 'lucide-react';

export default function AhspPage() {
  const [ahspList, setAhspList] = useState([]);
  const [selectedAhspId, setSelectedAhspId] = useState('');
  const [selectedAhsp, setSelectedAhsp] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State untuk Overhead (Default 15%)
  const [overheadPct, setOverheadPct] = useState(15);

  // 1. Fetch Daftar Induk AHSP
  const fetchAhspList = async () => {
    setLoading(true);
    const { data } = await supabase.from('ahsp_templates').select('*').order('name');
    if (data && data.length > 0) {
      setAhspList(data);
      if (!selectedAhspId) {
        setSelectedAhspId(data[0].id);
        setSelectedAhsp(data[0]);
      }
    }
    setLoading(false);
  };

  // 2. Fetch Detail Komponen (Fetch terpisah agar anti-gagal)
  const fetchAhspDetails = useCallback(async (ahspId) => {
    if (!ahspId) return;
    
    const { data: detailData, error: detailError } = await supabase
      .from('ahsp_details')
      .select('*')
      .eq('ahsp_template_id', ahspId);
      
    if (detailError) {
      console.error("Error detail:", detailError);
      return;
    }

    if (detailData) {
      const hsdIds = detailData.map(d => d.hsd_id).filter(id => id);
      let hsdData = [];
      
      if (hsdIds.length > 0) {
        const { data: hsdRes } = await supabase
          .from('master_hsd')
          .select('*')
          .in('id', hsdIds);
        hsdData = hsdRes || [];
      }

      const merged = detailData.map(d => ({
        ...d,
        master_hsd: hsdData.find(h => h.id === d.hsd_id) || {}
      }));
      
      setDetails(merged);
    }
  }, []);

  useEffect(() => { 
    fetchAhspList(); 
  }, []);

  useEffect(() => {
    if (selectedAhspId) {
      const ahsp = ahspList.find(a => a.id === selectedAhspId);
      setSelectedAhsp(ahsp);
      fetchAhspDetails(selectedAhspId);
    }
  }, [selectedAhspId, ahspList, fetchAhspDetails]);

  // 3. Handle Refresh dari Modal
  const handleRefresh = () => {
    if (selectedAhspId) {
      fetchAhspDetails(selectedAhspId);
    }
  };

  // 4. Fungsi Hapus Komponen
  const handleDeleteDetail = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus komponen ini dari AHSP?")) return;
    
    const { error } = await supabase.from('ahsp_details').delete().eq('id', id);
    
    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      handleRefresh(); // Refresh tabel setelah dihapus
    }
  };

  // --- KALKULASI TOTAL PUPR ---
  const getTotalByType = (typeString) => {
    return details
      .filter(d => d.master_hsd?.tipe?.toLowerCase() === typeString.toLowerCase())
      .reduce((sum, d) => sum + (Number(d.koefisien) * Number(d.master_hsd?.harga_dasar || 0)), 0);
  };

  const totalUpah = getTotalByType('Upah');
  const totalBahan = getTotalByType('Bahan');
  const totalAlat = getTotalByType('Alat');
  
  const totalD = totalUpah + totalBahan + totalAlat;
  const totalE = totalD * (overheadPct / 100);
  const totalF = totalD + totalE;

  if (loading) return <LoadingSpinner text="Memuat Katalog AHSP..." />;

  return (
    <div className="p-6 bg-slate-100 min-h-screen flex flex-col items-center">
      
      {/* KONTROL ATAS */}
      <div className="w-full max-w-5xl flex justify-between items-end mb-4 print:hidden bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col gap-1 w-1/2">
          <label className="text-xs font-bold text-slate-600">Pilih Template AHSP:</label>
          <select 
            value={selectedAhspId} 
            onChange={(e) => setSelectedAhspId(e.target.value)}
            className="border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full max-w-md"
          >
            {ahspList.map(a => (
              <option key={a.id} value={a.id}>
                {a.kode_ahsp ? `[${a.kode_ahsp}] ` : ''} {a.name} ({a.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2">
            <Plus size={16} /> Tambah Komponen
          </button>
          <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2">
            <Printer size={16} /> Cetak
          </button>
        </div>
      </div>

      {/* KERTAS DOKUMEN PUPR */}
      <div className="bg-white w-full max-w-5xl shadow-xl border border-slate-300 p-8 print:shadow-none print:border-none print:p-0">
        
        {selectedAhsp ? (
          <>
            {/* HEADER DOKUMEN */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-black border-b-2 border-black pb-2 mb-2">
                {selectedAhsp.kode_ahsp ? `${selectedAhsp.kode_ahsp} ` : ''} {selectedAhsp.name}
              </h1>
              <p className="text-sm font-semibold text-slate-700">Satuan: {selectedAhsp.unit}</p>
            </div>

            {/* TABEL PUPR */}
            <table className="w-full border-collapse border border-black text-[11px] text-black mb-8">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-black p-1 w-10">No</th>
                  <th className="border border-black p-1 text-left">Uraian</th>
                  <th className="border border-black p-1 w-20">Kode</th>
                  <th className="border border-black p-1 w-16">Satuan</th>
                  <th className="border border-black p-1 w-20">Koefisien</th>
                  <th className="border border-black p-1 w-32 text-right">Harga Satuan (Rp)</th>
                  <th className="border border-black p-1 w-32 text-right">Jumlah Harga (Rp)</th>
                  <th className="border border-black p-1 w-10 print:hidden">Aksi</th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border border-black p-1">1</th>
                  <th className="border border-black p-1">2</th>
                  <th className="border border-black p-1">3</th>
                  <th className="border border-black p-1">4</th>
                  <th className="border border-black p-1">5</th>
                  <th className="border border-black p-1">6</th>
                  <th className="border border-black p-1">7</th>
                  <th className="border border-black p-1 print:hidden">-</th>
                </tr>
              </thead>
              <tbody>
                
                {/* A. TENAGA KERJA */}
                <tr className="font-bold bg-gray-50">
                  <td className="border border-black p-1 text-center">A</td>
                  <td className="border border-black p-1" colSpan={7}>TENAGA KERJA</td>
                </tr>
                {details.filter(d => d.master_hsd?.tipe?.toLowerCase() === 'upah').map((d, i) => (
                  <tr key={d.id}>
                    <td className="border border-black p-1 text-center">{i+1}</td>
                    <td className="border border-black p-1">{d.master_hsd?.nama_item}</td>
                    <td className="border border-black p-1 text-center">{d.master_hsd?.kode || '-'}</td>
                    <td className="border border-black p-1 text-center">{d.master_hsd?.satuan}</td>
                    <td className="border border-black p-1 text-center">{Number(d.koefisien).toFixed(5)}</td>
                    <td className="border border-black p-1 text-right">{Number(d.master_hsd?.harga_dasar || 0).toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 text-right">{(Number(d.koefisien) * Number(d.master_hsd?.harga_dasar || 0)).toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 text-center print:hidden">
                      <button onClick={() => handleDeleteDetail(d.id)} className="text-red-500 hover:text-red-700" title="Hapus"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                <tr className="font-bold bg-gray-50">
                  <td className="border border-black p-1" colSpan={6} align="right">Jumlah Harga Tenaga Kerja (A)</td>
                  <td className="border border-black p-1 text-right">{totalUpah.toLocaleString('id-ID')}</td>
                  <td className="border border-black p-1 print:hidden"></td>
                </tr>

                {/* B. BAHAN */}
                <tr className="font-bold bg-gray-50">
                  <td className="border border-black p-1 text-center">B</td>
                  <td className="border border-black p-1" colSpan={7}>BAHAN</td>
                </tr>
                {details.filter(d => d.master_hsd?.tipe?.toLowerCase() === 'bahan').map((d, i) => (
                  <tr key={d.id}>
                    <td className="border border-black p-1 text-center">{i+1}</td>
                    <td className="border border-black p-1">{d.master_hsd?.nama_item}</td>
                    <td className="border border-black p-1 text-center">{d.master_hsd?.kode || '-'}</td>
                    <td className="border border-black p-1 text-center">{d.master_hsd?.satuan}</td>
                    <td className="border border-black p-1 text-center">{Number(d.koefisien).toFixed(5)}</td>
                    <td className="border border-black p-1 text-right">{Number(d.master_hsd?.harga_dasar || 0).toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 text-right">{(Number(d.koefisien) * Number(d.master_hsd?.harga_dasar || 0)).toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 text-center print:hidden">
                      <button onClick={() => handleDeleteDetail(d.id)} className="text-red-500 hover:text-red-700" title="Hapus"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                <tr className="font-bold bg-gray-50">
                  <td className="border border-black p-1" colSpan={6} align="right">Jumlah Harga Bahan (B)</td>
                  <td className="border border-black p-1 text-right">{totalBahan.toLocaleString('id-ID')}</td>
                  <td className="border border-black p-1 print:hidden"></td>
                </tr>

                {/* C. PERALATAN */}
                <tr className="font-bold bg-gray-50">
                  <td className="border border-black p-1 text-center">C</td>
                  <td className="border border-black p-1" colSpan={7}>PERALATAN</td>
                </tr>
                {details.filter(d => d.master_hsd?.tipe?.toLowerCase() === 'alat').map((d, i) => (
                  <tr key={d.id}>
                    <td className="border border-black p-1 text-center">{i+1}</td>
                    <td className="border border-black p-1">{d.master_hsd?.nama_item}</td>
                    <td className="border border-black p-1 text-center">{d.master_hsd?.kode || '-'}</td>
                    <td className="border border-black p-1 text-center">{d.master_hsd?.satuan}</td>
                    <td className="border border-black p-1 text-center">{Number(d.koefisien).toFixed(5)}</td>
                    <td className="border border-black p-1 text-right">{Number(d.master_hsd?.harga_dasar || 0).toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 text-right">{(Number(d.koefisien) * Number(d.master_hsd?.harga_dasar || 0)).toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 text-center print:hidden">
                      <button onClick={() => handleDeleteDetail(d.id)} className="text-red-500 hover:text-red-700" title="Hapus"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                <tr className="font-bold bg-gray-50">
                  <td className="border border-black p-1" colSpan={6} align="right">Jumlah Harga Peralatan (C)</td>
                  <td className="border border-black p-1 text-right">{totalAlat.toLocaleString('id-ID')}</td>
                  <td className="border border-black p-1 print:hidden"></td>
                </tr>

                {/* D. JUMLAH TOTAL */}
                <tr className="font-bold bg-gray-100">
                  <td className="border border-black p-1 text-center">D</td>
                  <td className="border border-black p-1" colSpan={5}>Jumlah Harga Tenaga Kerja, Bahan dan Peralatan (A+B+C)</td>
                  <td className="border border-black p-1 text-right">{totalD.toLocaleString('id-ID')}</td>
                  <td className="border border-black p-1 print:hidden"></td>
                </tr>

                {/* E. OVERHEAD & PROFIT */}
                <tr className="font-bold bg-gray-50">
                  <td className="border border-black p-1 text-center">E</td>
                  <td className="border border-black p-1" colSpan={5}>
                    Overhead + Profit 
                    <input 
                      type="number" 
                      value={overheadPct} 
                      onChange={(e) => setOverheadPct(Number(e.target.value))}
                      className="w-12 mx-2 border border-slate-400 rounded text-center text-black print:hidden"
                    />
                    <span className="print:inline hidden">({overheadPct}%)</span> x D
                  </td>
                  <td className="border border-black p-1 text-right">{totalE.toLocaleString('id-ID')}</td>
                  <td className="border border-black p-1 print:hidden"></td>
                </tr>

                {/* F. HARGA SATUAN PEKERJAAN */}
                <tr className="font-bold bg-gray-200 text-sm">
                  <td className="border border-black p-2 text-center">F</td>
                  <td className="border border-black p-2" colSpan={5}>Harga Satuan Pekerjaan (D+E)</td>
                  <td className="border border-black p-2 text-right">{totalF.toLocaleString('id-ID')}</td>
                  <td className="border border-black p-2 print:hidden"></td>
                </tr>

              </tbody>
            </table>
          </>
        ) : (
          <div className="text-center text-slate-500 py-10">Pilih AHSP terlebih dahulu.</div>
        )}
      </div>

      {/* MODAL TAMBAH KOMPONEN */}
      <AssignmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        ahspId={selectedAhspId} 
        onRefresh={handleRefresh} 
      />
    </div>
  );
}
