'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import AssignmentModal from '../../components/AssignmentModal';
import { Plus, Printer, Trash2, AlertTriangle, CheckCircle2, Save, X, Edit, Loader2, FileText } from 'lucide-react';

export default function AhspPage() {
  const [ahspList, setAhspList] = useState([]);
  const [selectedAhspId, setSelectedAhspId] = useState('');
  const [selectedAhsp, setSelectedAhsp] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Modal Assignment (Tambah Komponen)
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  
  // State Modal Master AHSP (Tambah AHSP Baru)
  const [isAhspModalOpen, setIsAhspModalOpen] = useState(false);
  const [editingAhsp, setEditingAhsp] = useState(null);
  const [isSavingAhsp, setIsSavingAhsp] = useState(false);
  const [formAhsp, setFormAhsp] = useState({ kode_ahsp: '', name: '', unit: 'Unit' });

  // State Overhead
  const [overheadPct, setOverheadPct] = useState(15);

  // State Custom Dialog & Toast
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

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
    } else {
      setAhspList([]);
      setSelectedAhsp(null);
    }
    setLoading(false);
  };

  // 2. Fetch Detail Komponen
  const fetchAhspDetails = useCallback(async (ahspId) => {
    if (!ahspId) return;
    
    const { data: detailData, error: detailError } = await supabase
      .from('ahsp_details')
      .select('*')
      .eq('ahsp_template_id', ahspId);
      
    if (detailError) {
      showToast('danger', "Gagal memuat detail: " + detailError.message);
      return;
    }

    if (detailData) {
      const hsdIds = detailData.map(d => d.hsd_id).filter(id => id);
      let hsdData = [];
      
      if (hsdIds.length > 0) {
        const { data: hsdRes } = await supabase.from('master_hsd').select('*').in('id', hsdIds);
        hsdData = hsdRes || [];
      }

      const merged = detailData.map(d => ({
        ...d,
        master_hsd: hsdData.find(h => h.id === d.hsd_id) || {}
      }));
      
      setDetails(merged);
    }
  }, []);

  useEffect(() => { fetchAhspList(); }, []);

  useEffect(() => {
    if (selectedAhspId) {
      const ahsp = ahspList.find(a => a.id === selectedAhspId);
      setSelectedAhsp(ahsp);
      fetchAhspDetails(selectedAhspId);
    }
  }, [selectedAhspId, ahspList, fetchAhspDetails]);

  const handleRefresh = () => {
    if (selectedAhspId) fetchAhspDetails(selectedAhspId);
  };

  // 3. Handle Tambah/Edit Master AHSP
  const handleOpenEditAhsp = () => {
    if (!selectedAhsp) return;
    setEditingAhsp(selectedAhsp);
    setFormAhsp({
      kode_ahsp: selectedAhsp.kode_ahsp || '',
      name: selectedAhsp.name,
      unit: selectedAhsp.unit
    });
    setIsAhspModalOpen(true);
  };

  const handleOpenNewAhsp = () => {
    setEditingAhsp(null);
    setFormAhsp({ kode_ahsp: '', name: '', unit: 'Unit' });
    setIsAhspModalOpen(true);
  };

  const handleSaveNewAhsp = async (e) => {
    e.preventDefault();
    setIsSavingAhsp(true);
    
    let error, data;
    if (editingAhsp) {
      const res = await supabase.from('ahsp_templates')
        .update({
          kode_ahsp: formAhsp.kode_ahsp,
          name: formAhsp.name,
          unit: formAhsp.unit
        })
        .eq('id', editingAhsp.id)
        .select().maybeSingle();
      error = res.error; data = res.data;
    } else {
      const res = await supabase.from('ahsp_templates')
        .insert([{
          kode_ahsp: formAhsp.kode_ahsp,
          name: formAhsp.name,
          unit: formAhsp.unit,
          total_direct_cost: 0,
          total_harga_ahsp: 0
        }])
        .select().maybeSingle();
      error = res.error; data = res.data;
    }

    if (error) {
      showToast('danger', "Gagal menyimpan AHSP: " + error.message);
    } else {
      setIsAhspModalOpen(false);
      setFormAhsp({ kode_ahsp: '', name: '', unit: 'Unit' });
      showToast('success', 'Master AHSP berhasil disimpan!');
      await fetchAhspList();
      if (data) setSelectedAhspId(data.id);
    }
    setIsSavingAhsp(false);
  };

  // 4. Update Koefisien
  const handleUpdateKoefisien = async (detailId, newKoefisien) => {
    const val = Number(newKoefisien) || 0;
    setDetails(prev => prev.map(d => d.id === detailId ? { ...d, koefisien: val } : d));
    const { error } = await supabase.from('ahsp_details').update({ koefisien: val }).eq('id', detailId);
    if (error) {
      showToast('danger', "Gagal update koefisien: " + error.message);
      handleRefresh(); 
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    const { error } = await supabase.from('ahsp_details').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('danger', "Gagal menghapus: " + error.message);
    } else {
      showToast('success', "Komponen berhasil dihapus.");
      handleRefresh();
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  // --- KALKULASI TOTAL ---
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
    <>
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { background-color: white !important; }
          .print-hidden { display: none !important; }
          .print-container { 
            box-shadow: none !important; border: none !important; padding: 0 !important; 
            margin: 0 !important; width: 100% !important; max-width: 100% !important;
          }
          main { padding: 0 !important; overflow: visible !important; }
        }
      `}</style>

      <div className="p-6 w-full bg-slate-50 min-h-screen relative print:bg-white print:p-0">
        
        {/* TOAST NOTIFICATION */}
        {toast && (
          <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-xl shadow-xl text-white font-bold animate-in slide-in-from-top-4 fade-in flex items-center gap-2 print-hidden ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}

        {/* KONTROL ATAS (RESPONSIVE) */}
        <div className="w-full max-w-[1700px] mx-auto mb-6 print-hidden">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            
            {/* KIRI: Pilih Template & AHSP Baru */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto flex-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Template AHSP:</label>
              <div className="flex flex-col sm:flex-row gap-2 w-full xl:max-w-xl">
                <select 
                  value={selectedAhspId} 
                  onChange={(e) => setSelectedAhspId(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium truncate"
                >
                  {ahspList.length === 0 && <option value="">Belum ada data AHSP</option>}
                  {ahspList.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.kode_ahsp ? `[${a.kode_ahsp}] ` : ''} {a.name} ({a.unit})
                    </option>
                  ))}
                </select>
                <button 
                  onClick={handleOpenNewAhsp} 
                  className="w-full sm:w-auto shrink-0 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Plus size={16} /> AHSP Baru
                </button>
              </div>
            </div>

            {/* KANAN: Aksi Cepat */}
            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto shrink-0 mt-2 xl:mt-0">
              <button onClick={() => setIsAssignmentModalOpen(true)} disabled={!selectedAhsp} className="w-full sm:w-auto justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:bg-slate-400 disabled:shadow-none whitespace-nowrap">
                <Plus size={16} /> Tambah Komponen
              </button>
              <button onClick={() => window.print()} disabled={!selectedAhsp} className="w-full sm:w-auto justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 whitespace-nowrap">
                <Printer size={16} /> Cetak PDF
              </button>
            </div>

          </div>
        </div>

        {/* KERTAS DOKUMEN PUPR */}
        <div className="bg-white w-full max-w-[1700px] mx-auto shadow-xl border border-slate-300 p-8 print-container rounded-sm">
          {selectedAhsp ? (
            <>
              {/* HEADER DOKUMEN */}
              <div className="mb-6 border-b-2 border-slate-800 pb-4 relative">
                <div className="absolute right-0 top-0 print-hidden">
                  <button onClick={handleOpenEditAhsp} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-sm" title="Edit Nama & Satuan AHSP">
                    <Edit size={14} /> Edit Header
                  </button>
                </div>
                <h1 className="text-xl font-extrabold text-slate-900 uppercase mb-1 tracking-tight">
                  ANALISA HARGA SATUAN PEKERJAAN (AHSP)
                </h1>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mt-2 gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800 leading-snug">
                      {selectedAhsp.kode_ahsp ? `[${selectedAhsp.kode_ahsp}] ` : ''} {selectedAhsp.name}
                    </p>
                    <p className="text-sm text-slate-600 font-medium mt-1">Satuan Pekerjaan: {selectedAhsp.unit}</p>
                  </div>
                  <div className="text-left md:text-right text-xs text-slate-500 font-medium">
                    <p>Proyek Konstruksi</p>
                    <p>Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
              </div>

              {/* TABEL PUPR */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-800 text-sm text-slate-800 mb-8">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-800 p-2 w-10 text-center font-bold">No</th>
                      <th className="border border-slate-800 p-2 text-left font-bold">Uraian</th>
                      <th className="border border-slate-800 p-2 w-20 text-center font-bold">Kode</th>
                      <th className="border border-slate-800 p-2 w-16 text-center font-bold">Satuan</th>
                      <th className="border border-slate-800 p-2 w-24 text-center font-bold">Koefisien</th>
                      <th className="border border-slate-800 p-2 w-32 text-right font-bold">Harga Satuan (Rp)</th>
                      <th className="border border-slate-800 p-2 w-32 text-right font-bold">Jumlah Harga (Rp)</th>
                      <th className="border border-slate-800 p-2 w-10 text-center font-bold print-hidden">Aksi</th>
                    </tr>
                    <tr className="bg-slate-50 text-[10px]">
                      <th className="border border-slate-800 p-1 text-center">1</th>
                      <th className="border border-slate-800 p-1 text-center">2</th>
                      <th className="border border-slate-800 p-1 text-center">3</th>
                      <th className="border border-slate-800 p-1 text-center">4</th>
                      <th className="border border-slate-800 p-1 text-center">5</th>
                      <th className="border border-slate-800 p-1 text-center">6</th>
                      <th className="border border-slate-800 p-1 text-center">7</th>
                      <th className="border border-slate-800 p-1 text-center print-hidden">-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* A. TENAGA KERJA */}
                    <tr className="font-bold bg-slate-50">
                      <td className="border border-slate-800 p-1.5 text-center">A</td>
                      <td className="border border-slate-800 p-1.5" colSpan={7}>TENAGA KERJA</td>
                    </tr>
                    {details.filter(d => d.master_hsd?.tipe?.toLowerCase() === 'upah').map((d, i) => (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="border border-slate-800 p-1 text-center text-slate-500">{i+1}</td>
                        <td className="border border-slate-800 p-1 font-medium">{d.master_hsd?.nama_item}</td>
                        <td className="border border-slate-800 p-1 text-center text-slate-500">{d.master_hsd?.kode || '-'}</td>
                        <td className="border border-slate-800 p-1 text-center">{d.master_hsd?.satuan}</td>
                        <td className="border border-slate-800 p-0 text-center relative">
                          <input
                            type="number" step="any" defaultValue={Number(d.koefisien)}
                            onBlur={(e) => handleUpdateKoefisien(d.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-full min-h-[36px] text-center tabular-nums bg-transparent outline-none hover:bg-slate-100 focus:bg-indigo-50 focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all cursor-text print:appearance-none print:bg-transparent font-bold"
                            title="Klik untuk mengedit koefisien"
                          />
                        </td>
                        <td className="border border-slate-800 p-1 text-right tabular-nums text-slate-600">{Number(d.master_hsd?.harga_dasar || 0).toLocaleString('id-ID')}</td>
                        <td className="border border-slate-800 p-1 text-right tabular-nums font-bold">{(Number(d.koefisien) * Number(d.master_hsd?.harga_dasar || 0)).toLocaleString('id-ID')}</td>
                        <td className="border border-slate-800 p-1 text-center print-hidden">
                          <button onClick={() => setDeleteTarget(d)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Hapus"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-slate-50 text-xs">
                      <td className="border border-slate-800 p-2" colSpan={6} align="right">Jumlah Harga Tenaga Kerja (A)</td>
                      <td className="border border-slate-800 p-2 text-right tabular-nums">{totalUpah.toLocaleString('id-ID')}</td>
                      <td className="border border-slate-800 p-2 print-hidden"></td>
                    </tr>

                    {/* B. BAHAN */}
                    <tr className="font-bold bg-slate-50">
                      <td className="border border-slate-800 p-1.5 text-center">B</td>
                      <td className="border border-slate-800 p-1.5" colSpan={7}>BAHAN</td>
                    </tr>
                    {details.filter(d => d.master_hsd?.tipe?.toLowerCase() === 'bahan').map((d, i) => (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="border border-slate-800 p-1 text-center text-slate-500">{i+1}</td>
                        <td className="border border-slate-800 p-1 font-medium">{d.master_hsd?.nama_item}</td>
                        <td className="border border-slate-800 p-1 text-center text-slate-500">{d.master_hsd?.kode || '-'}</td>
                        <td className="border border-slate-800 p-1 text-center">{d.master_hsd?.satuan}</td>
                        <td className="border border-slate-800 p-0 text-center relative">
                          <input
                            type="number" step="any" defaultValue={Number(d.koefisien)}
                            onBlur={(e) => handleUpdateKoefisien(d.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-full min-h-[36px] text-center tabular-nums bg-transparent outline-none hover:bg-slate-100 focus:bg-indigo-50 focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all cursor-text print:appearance-none print:bg-transparent font-bold"
                            title="Klik untuk mengedit koefisien"
                          />
                        </td>
                        <td className="border border-slate-800 p-1 text-right tabular-nums text-slate-600">{Number(d.master_hsd?.harga_dasar || 0).toLocaleString('id-ID')}</td>
                        <td className="border border-slate-800 p-1 text-right tabular-nums font-bold">{(Number(d.koefisien) * Number(d.master_hsd?.harga_dasar || 0)).toLocaleString('id-ID')}</td>
                        <td className="border border-slate-800 p-1 text-center print-hidden">
                          <button onClick={() => setDeleteTarget(d)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Hapus"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-slate-50 text-xs">
                      <td className="border border-slate-800 p-2" colSpan={6} align="right">Jumlah Harga Bahan (B)</td>
                      <td className="border border-slate-800 p-2 text-right tabular-nums">{totalBahan.toLocaleString('id-ID')}</td>
                      <td className="border border-slate-800 p-2 print-hidden"></td>
                    </tr>

                    {/* C. PERALATAN */}
                    <tr className="font-bold bg-slate-50">
                      <td className="border border-slate-800 p-1.5 text-center">C</td>
                      <td className="border border-slate-800 p-1.5" colSpan={7}>PERALATAN</td>
                    </tr>
                    {details.filter(d => d.master_hsd?.tipe?.toLowerCase() === 'alat').map((d, i) => (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="border border-slate-800 p-1 text-center text-slate-500">{i+1}</td>
                        <td className="border border-slate-800 p-1 font-medium">{d.master_hsd?.nama_item}</td>
                        <td className="border border-slate-800 p-1 text-center text-slate-500">{d.master_hsd?.kode || '-'}</td>
                        <td className="border border-slate-800 p-1 text-center">{d.master_hsd?.satuan}</td>
                        <td className="border border-slate-800 p-0 text-center relative">
                          <input
                            type="number" step="any" defaultValue={Number(d.koefisien)}
                            onBlur={(e) => handleUpdateKoefisien(d.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-full min-h-[36px] text-center tabular-nums bg-transparent outline-none hover:bg-slate-100 focus:bg-indigo-50 focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all cursor-text print:appearance-none print:bg-transparent font-bold"
                            title="Klik untuk mengedit koefisien"
                          />
                        </td>
                        <td className="border border-slate-800 p-1 text-right tabular-nums text-slate-600">{Number(d.master_hsd?.harga_dasar || 0).toLocaleString('id-ID')}</td>
                        <td className="border border-slate-800 p-1 text-right tabular-nums font-bold">{(Number(d.koefisien) * Number(d.master_hsd?.harga_dasar || 0)).toLocaleString('id-ID')}</td>
                        <td className="border border-slate-800 p-1 text-center print-hidden">
                          <button onClick={() => setDeleteTarget(d)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Hapus"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-slate-50 text-xs">
                      <td className="border border-slate-800 p-2" colSpan={6} align="right">Jumlah Harga Peralatan (C)</td>
                      <td className="border border-slate-800 p-2 text-right tabular-nums">{totalAlat.toLocaleString('id-ID')}</td>
                      <td className="border border-slate-800 p-2 print-hidden"></td>
                    </tr>

                    {/* D. JUMLAH TOTAL */}
                    <tr className="font-bold bg-slate-100 text-xs">
                      <td className="border border-slate-800 p-2 text-center">D</td>
                      <td className="border border-slate-800 p-2" colSpan={5}>Jumlah Harga Tenaga Kerja, Bahan dan Peralatan (A+B+C)</td>
                      <td className="border border-slate-800 p-2 text-right tabular-nums text-indigo-700">{totalD.toLocaleString('id-ID')}</td>
                      <td className="border border-slate-800 p-2 print-hidden"></td>
                    </tr>

                    {/* E. OVERHEAD & PROFIT */}
                    <tr className="font-bold bg-slate-50 text-xs">
                      <td className="border border-slate-800 p-2 text-center">E</td>
                      <td className="border border-slate-800 p-2" colSpan={5}>
                        Overhead + Profit 
                        <input 
                          type="number" 
                          value={overheadPct} 
                          onChange={(e) => setOverheadPct(Number(e.target.value))}
                          className="w-14 mx-2 border border-slate-300 rounded-lg text-center text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 outline-none print-hidden tabular-nums"
                        />
                        <span className="hidden print:inline">({overheadPct}%)</span> x D
                      </td>
                      <td className="border border-slate-800 p-2 text-right tabular-nums">{totalE.toLocaleString('id-ID')}</td>
                      <td className="border border-slate-800 p-2 print-hidden"></td>
                    </tr>

                    {/* F. HARGA SATUAN PEKERJAAN */}
                    <tr className="font-bold bg-slate-200 text-sm">
                      <td className="border border-slate-800 p-3 text-center">F</td>
                      <td className="border border-slate-800 p-3" colSpan={5}>Harga Satuan Pekerjaan (D+E)</td>
                      <td className="border border-slate-800 p-3 text-right tabular-nums text-emerald-700 text-base">{totalF.toLocaleString('id-ID')}</td>
                      <td className="border border-slate-800 p-3 print-hidden"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* TANDA TANGAN */}
              <div className="hidden print:grid grid-cols-2 gap-8 mt-12 text-center text-xs">
                <div>
                  <p>Diperiksa Oleh,</p>
                  <p>Konsultan Pengawas</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-b border-black inline-block px-8">( .............................. )</p>
                </div>
                <div>
                  <p>Disetujui Oleh,</p>
                  <p>Pemilik Proyek (PPK)</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-b border-black inline-block px-8">( .............................. )</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <FileText size={64} className="mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-slate-600">Belum Ada Data AHSP</h3>
              <p className="text-sm mt-1 mb-4">Silakan buat master AHSP baru untuk memulai analisa harga.</p>
              <button onClick={handleOpenNewAhsp} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
                <Plus size={18} /> Buat AHSP Pertama
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL TAMBAH/EDIT MASTER AHSP */}
      {isAhspModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 print-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {editingAhsp ? <Edit className="text-indigo-600" size={20}/> : <Plus className="text-indigo-600" size={20}/>}
                {editingAhsp ? 'Edit Master AHSP' : 'Buat Master AHSP Baru'}
              </h2>
              <button onClick={() => setIsAhspModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-white p-1.5 rounded-lg border border-slate-200 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveNewAhsp} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kode AHSP</label>
                <input required type="text" value={formAhsp.kode_ahsp} onChange={e => setFormAhsp({...formAhsp, kode_ahsp: e.target.value})} placeholder="cth: AHSP-02" className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Pekerjaan / Analisa</label>
                <input required type="text" value={formAhsp.name} onChange={e => setFormAhsp({...formAhsp, name: e.target.value})} placeholder="cth: Pekerjaan Galian Tanah" className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Satuan Pekerjaan</label>
                <select value={formAhsp.unit} onChange={e => setFormAhsp({...formAhsp, unit: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white transition-all font-medium">
                  <option value="Unit">Unit</option><option value="LS">LS (Lump Sum)</option><option value="M3">M3 (Kubik)</option><option value="M2">M2 (Persegi)</option><option value="M1">M1 (Meter Lari)</option><option value="Kg">Kg (Kilogram)</option><option value="Titik">Titik</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsAhspModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSavingAhsp} className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 ${isSavingAhsp ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}>
                  {isSavingAhsp ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <><Save size={18} /> {editingAhsp ? 'Simpan Perubahan' : 'Simpan AHSP'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENTERPRISE DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 print-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 mb-4 border border-rose-200">
              <AlertTriangle className="h-8 w-8 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Komponen Ini?</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">
              Anda akan menghapus <strong className="text-slate-800">{deleteTarget.master_hsd?.nama_item}</strong> dari AHSP ini.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 w-full transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-5 py-2.5 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-md shadow-rose-500/20 w-full transition-colors flex items-center justify-center gap-2 disabled:bg-rose-400">
                {isDeleting ? <><Loader2 size={16} className="animate-spin" /> Menghapus...</> : <><Trash2 size={16} /> Ya, Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH KOMPONEN */}
      <AssignmentModal 
        isOpen={isAssignmentModalOpen} 
        onClose={() => setIsAssignmentModalOpen(false)} 
        ahspId={selectedAhspId} 
        onRefresh={handleRefresh} 
      />
    </>
  );
}