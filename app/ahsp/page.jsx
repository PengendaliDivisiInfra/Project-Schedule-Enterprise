'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import AssignmentModal from '../../components/AssignmentModal';
import { Plus, Printer, Trash2, AlertTriangle, CheckCircle2, Save, X } from 'lucide-react';

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

  // 3. Handle Tambah Master AHSP
  const handleSaveNewAhsp = async (e) => {
    e.preventDefault();
    setIsSavingAhsp(true);
    
    const { data, error } = await supabase
      .from('ahsp_templates')
      .insert([{
        kode_ahsp: formAhsp.kode_ahsp,
        name: formAhsp.name,
        unit: formAhsp.unit,
        total_direct_cost: 0,
        total_harga_ahsp: 0
      }])
      .select()
      .single();

    if (error) {
      alert("Gagal membuat AHSP: " + error.message);
    } else {
      setIsAhspModalOpen(false);
      setFormAhsp({ kode_ahsp: '', name: '', unit: 'Unit' });
      showToast('success', 'Master AHSP berhasil dibuat!');
      await fetchAhspList();
      if (data) setSelectedAhspId(data.id);
    }
    setIsSavingAhsp(false);
  };

  // 4. Konfirmasi Hapus Komponen
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
            box-shadow: none !important; 
            border: none !important; 
            padding: 0 !important; 
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          /* Reset margin sidebar/main */
          main { padding: 0 !important; overflow: visible !important; }
        }
      `}</style>

      <div className="p-6 bg-slate-100 min-h-screen flex flex-col items-center relative print:bg-white print:p-0">
        
        {/* TOAST NOTIFICATION */}
        {toast && (
          <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 print-hidden ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}

        {/* KONTROL ATAS (Hilang saat print) */}
        <div className="w-full max-w-5xl flex justify-between items-end mb-4 print-hidden bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col gap-1 w-1/2">
            <label className="text-xs font-bold text-slate-600">Pilih Template AHSP:</label>
            <div className="flex gap-2">
              <select 
                value={selectedAhspId} 
                onChange={(e) => setSelectedAhspId(e.target.value)}
                className="flex-1 border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {ahspList.length === 0 && <option value="">Belum ada data AHSP</option>}
                {ahspList.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.kode_ahsp ? `[${a.kode_ahsp}] ` : ''} {a.name} ({a.unit})
                  </option>
                ))}
              </select>
              <button 
                onClick={() => setIsAhspModalOpen(true)} 
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Plus size={16} /> Buat AHSP Baru
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsAssignmentModalOpen(true)} disabled={!selectedAhsp} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2 disabled:bg-slate-400">
              <Plus size={16} /> Tambah Komponen
            </button>
            <button onClick={() => window.print()} disabled={!selectedAhsp} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2 disabled:bg-slate-400">
              <Printer size={16} /> Cetak PDF
            </button>
          </div>
        </div>

        {/* KERTAS DOKUMEN PUPR (Saat Print, class print-container akan membuat ini bersih) */}
        <div className="bg-white w-full max-w-5xl shadow-xl border border-slate-300 p-8 print-container">
          {selectedAhsp ? (
            <>
              {/* HEADER DOKUMEN */}
              <div className="mb-6 border-b-2 border-black pb-4">
                <h1 className="text-xl font-bold text-black uppercase mb-1">
                  ANALISA HARGA SATUAN PEKERJAAN (AHSP)
                </h1>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {selectedAhsp.kode_ahsp ? `[${selectedAhsp.kode_ahsp}] ` : ''} {selectedAhsp.name}
                    </p>
                    <p className="text-sm text-slate-600">Satuan Pekerjaan: {selectedAhsp.unit}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>Proyek Jembatan Cisomang</p>
                    <p>Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
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
                    <th className="border border-black p-1 w-10 print-hidden">Aksi</th>
                  </tr>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1">1</th>
                    <th className="border border-black p-1">2</th>
                    <th className="border border-black p-1">3</th>
                    <th className="border border-black p-1">4</th>
                    <th className="border border-black p-1">5</th>
                    <th className="border border-black p-1">6</th>
                    <th className="border border-black p-1">7</th>
                    <th className="border border-black p-1 print-hidden">-</th>
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
                      <td className="border border-black p-1 text-center print-hidden">
                        <button onClick={() => setDeleteTarget(d)} className="text-red-500 hover:text-red-700" title="Hapus"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-50">
                    <td className="border border-black p-1" colSpan={6} align="right">Jumlah Harga Tenaga Kerja (A)</td>
                    <td className="border border-black p-1 text-right">{totalUpah.toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 print-hidden"></td>
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
                      <td className="border border-black p-1 text-center print-hidden">
                        <button onClick={() => setDeleteTarget(d)} className="text-red-500 hover:text-red-700" title="Hapus"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-50">
                    <td className="border border-black p-1" colSpan={6} align="right">Jumlah Harga Bahan (B)</td>
                    <td className="border border-black p-1 text-right">{totalBahan.toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 print-hidden"></td>
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
                      <td className="border border-black p-1 text-center print-hidden">
                        <button onClick={() => setDeleteTarget(d)} className="text-red-500 hover:text-red-700" title="Hapus"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-50">
                    <td className="border border-black p-1" colSpan={6} align="right">Jumlah Harga Peralatan (C)</td>
                    <td className="border border-black p-1 text-right">{totalAlat.toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 print-hidden"></td>
                  </tr>

                  {/* D. JUMLAH TOTAL */}
                  <tr className="font-bold bg-gray-100">
                    <td className="border border-black p-1 text-center">D</td>
                    <td className="border border-black p-1" colSpan={5}>Jumlah Harga Tenaga Kerja, Bahan dan Peralatan (A+B+C)</td>
                    <td className="border border-black p-1 text-right">{totalD.toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 print-hidden"></td>
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
                        className="w-12 mx-2 border border-slate-400 rounded text-center text-black print-hidden"
                      />
                      <span className="hidden print:inline">({overheadPct}%)</span> x D
                    </td>
                    <td className="border border-black p-1 text-right">{totalE.toLocaleString('id-ID')}</td>
                    <td className="border border-black p-1 print-hidden"></td>
                  </tr>

                  {/* F. HARGA SATUAN PEKERJAAN */}
                  <tr className="font-bold bg-gray-200 text-sm">
                    <td className="border border-black p-2 text-center">F</td>
                    <td className="border border-black p-2" colSpan={5}>Harga Satuan Pekerjaan (D+E)</td>
                    <td className="border border-black p-2 text-right">{totalF.toLocaleString('id-ID')}</td>
                    <td className="border border-black p-2 print-hidden"></td>
                  </tr>
                </tbody>
              </table>
              
              {/* TANDA TANGAN (Hanya saat print) */}
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
            <div className="text-center text-slate-500 py-10">Silakan buat atau pilih AHSP terlebih dahulu.</div>
          )}
        </div>
      </div>

      {/* MODAL TAMBAH MASTER AHSP */}
      {isAhspModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in print-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">📁 Buat Master AHSP Baru</h2>
              <button onClick={() => setIsAhspModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveNewAhsp} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kode AHSP</label>
                <input required type="text" value={formAhsp.kode_ahsp} onChange={e => setFormAhsp({...formAhsp, kode_ahsp: e.target.value})} placeholder="cth: AHSP-02" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Pekerjaan / Analisa</label>
                <input required type="text" value={formAhsp.name} onChange={e => setFormAhsp({...formAhsp, name: e.target.value})} placeholder="cth: Pekerjaan Galian Tanah" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Satuan Pekerjaan</label>
                <select value={formAhsp.unit} onChange={e => setFormAhsp({...formAhsp, unit: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="Unit">Unit</option>
                  <option value="LS">LS (Lump Sum)</option>
                  <option value="M3">M3 (Kubik)</option>
                  <option value="M2">M2 (Persegi)</option>
                  <option value="M1">M1 (Meter Lari)</option>
                  <option value="Kg">Kg (Kilogram)</option>
                  <option value="Titik">Titik</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsAhspModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSavingAhsp} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${isSavingAhsp ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isSavingAhsp ? 'Menyimpan...' : <><Save size={16} /> Simpan AHSP</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENTERPRISE DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in print-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Komponen Ini?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Anda akan menghapus <strong className="text-slate-800">{deleteTarget.master_hsd?.nama_item}</strong> dari AHSP.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 w-full transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md w-full transition-colors flex items-center justify-center gap-2 disabled:bg-red-400">
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH KOMPONEN (Dari file terpisah) */}
      <AssignmentModal 
        isOpen={isAssignmentModalOpen} 
        onClose={() => setIsAssignmentModalOpen(false)} 
        ahspId={selectedAhspId} 
        onRefresh={handleRefresh} 
      />
    </>
  );
}
