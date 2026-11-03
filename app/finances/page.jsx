'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, X, Loader2, Save, CheckCircle2, UploadCloud } from 'lucide-react';

export default function CashFlowPage() {
  const [flows, setFlows] = useState([]);
  const [tasks, setTasks] = useState([]); // Untuk dropdown WBS
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // State Upload File
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    type: 'OUT', 
    category: 'Material', 
    description: '', 
    amount: 0, 
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'Transfer',
    vendor_or_ref: '',
    wbs_code: ''
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    // Fetch transaksi
    const { data: flowData } = await supabase.from('cash_flows').select('*').order('transaction_date', { ascending: false });
    if (flowData) setFlows(flowData);

    // Fetch WBS untuk dropdown
    const { data: taskData } = await supabase.from('wbs_tasks').select('wbs_code, name').eq('summary', 'No').order('wbs_code');
    if (taskData) setTasks(taskData);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    let finalAttachmentUrl = null;

    try {
      // 1. Upload File jika ada
      if (file) {
        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `fin_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('evidence').upload(fileName, file);
        if (uploadError) throw new Error("Gagal upload nota: " + uploadError.message);

        const { data: urlData } = supabase.storage.from('evidence').getPublicUrl(fileName);
        finalAttachmentUrl = urlData.publicUrl;
      }

      // 2. Simpan ke Database
      const payload = { 
        ...formData, 
        amount: Number(formData.amount),
        attachment_url: finalAttachmentUrl 
      };
      
      const { error } = await supabase.from('cash_flows').insert([payload]);
      if (error) throw error;

      setIsModalOpen(false);
      showToast('success', 'Transaksi berhasil disimpan!');
      setFormData({ type: 'OUT', category: 'Material', description: '', amount: 0, transaction_date: new Date().toISOString().split('T')[0], payment_method: 'Transfer', vendor_or_ref: '', wbs_code: '' });
      setFile(null);
      fetchData();

    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  // Kalkulasi
  const totalIn = flows.filter(f => f.type === 'IN').reduce((sum, f) => sum + Number(f.amount), 0);
  const totalOut = flows.filter(f => f.type === 'OUT').reduce((sum, f) => sum + Number(f.amount), 0);
  const netCash = totalIn - totalOut;

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

  if (loading) return <LoadingSpinner text="Memuat Data Keuangan..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle2 size={18} /> {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Wallet className="text-indigo-600" /> Cash Flow Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">Pantau arus kas masuk (Termin/DP) dan pengeluaran (Material/Upah) proyek.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-colors flex items-center gap-2">
            <Plus size={16} /> Tambah Transaksi
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Kas Masuk</p>
              <p className="text-xl font-bold text-emerald-600">{formatRp(totalIn)}</p>
            </div>
            <ArrowDownCircle className="text-emerald-500 opacity-50" size={40} />
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-red-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Kas Keluar</p>
              <p className="text-xl font-bold text-red-600">{formatRp(totalOut)}</p>
            </div>
            <ArrowUpCircle className="text-red-500 opacity-50" size={40} />
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-indigo-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Saldo Bersih (Net)</p>
              <p className={`text-xl font-bold ${netCash >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatRp(netCash)}</p>
            </div>
            <Wallet className="text-indigo-500 opacity-50" size={40} />
          </div>
        </div>

        {/* TABEL TRANSAKSI */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-28">Tanggal</th>
                  <th className="p-3 w-24 text-center">Tipe</th>
                  <th className="p-3 w-32">Kategori</th>
                  <th className="p-3 w-24">WBS</th>
                  <th className="p-3">Vendor / Keterangan</th>
                  <th className="p-3 w-32">Metode</th>
                  <th className="p-3 w-36 text-right">Nominal (Rp)</th>
                  <th className="p-3 w-16 text-center">Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flows.length === 0 && (
                  <tr><td colSpan={8} className="p-10 text-center text-slate-500 italic">Belum ada data transaksi keuangan.</td></tr>
                )}
                {flows.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{new Date(f.transaction_date).toLocaleDateString('id-ID')}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                        f.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>{f.type === 'IN' ? 'MASUK' : 'KELUAR'}</span>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{f.category}</td>
                    <td className="p-3 font-mono text-xs">{f.wbs_code || '-'}</td>
                    <td className="p-3 text-slate-600 truncate max-w-[150px]" title={f.vendor_or_ref || f.description}>
                      {f.vendor_or_ref ? <strong>{f.vendor_or_ref}</strong> : f.description || '-'}
                    </td>
                    <td className="p-3 text-xs">{f.payment_method || 'Transfer'}</td>
                    <td className={`p-3 text-right font-bold ${f.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {f.type === 'IN' ? '+' : '-'} {formatRp(f.amount)}
                    </td>
                    <td className="p-3 text-center">
                      {f.attachment_url ? (
                        <a href={f.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-bold">Lihat</a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL TAMBAH TRANSAKSI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-indigo-600"/> Tambah Transaksi Keuangan</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Transaksi</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, category: e.target.value === 'IN' ? 'Termin' : 'Material'})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="IN">Kas Masuk (Pemasukan)</option>
                    <option value="OUT">Kas Keluar (Pengeluaran)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal</label>
                  <input required type="date" value={formData.transaction_date} onChange={e => setFormData({...formData, transaction_date: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    {formData.type === 'IN' ? (
                      <><option value="DP">Uang Muka (DP)</option><option value="Termin">Termin Pembayaran</option><option value="Retensi">Pencairan Retensi</option><option value="Lainnya">Lainnya</option></>
                    ) : (
                      <><option value="Material">Pembelian Material</option><option value="Upah">Upah Tenaga Kerja</option><option value="Alat">Sewa Alat Berat</option><option value="Operasional">Biaya Operasional</option><option value="Subkon">Pembayaran Subkon</option><option value="Lainnya">Lainnya</option></>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Relasi WBS (Budget Link)</label>
                  <select value={formData.wbs_code} onChange={e => setFormData({...formData, wbs_code: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="">-- Tanpa Relasi WBS --</option>
                    {tasks.map(t => <option key={t.wbs_code} value={t.wbs_code}>[{t.wbs_code}] {t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Vendor / No. Invoice (Opsional)</label>
                  <input type="text" value={formData.vendor_or_ref} onChange={e => setFormData({...formData, vendor_or_ref: e.target.value})} placeholder="cth: PT. Baja Perkasa / INV-001" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Metode Pembayaran</label>
                  <select value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="Transfer">Transfer Bank</option>
                    <option value="Petty Cash">Petty Cash (Kas Kecil)</option>
                    <option value="Giro">Giro / Cheque</option>
                    <option value="Tunai">Tunai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nominal (Rp)</label>
                <input required type="number" min="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg" onFocus={(e) => e.target.select()} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Keterangan Tambahan</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="cth: Pembelian besi 10mm 50 batang" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Upload Bukti Transaksi (Nota/Kuitansi)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                    <UploadCloud size={16} /> Pilih File
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
                  </label>
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">
                    {file ? file.name : 'Belum ada file (Opsional)'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving || isUploading} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${(isSaving || isUploading) ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {(isSaving || isUploading) ? <><Loader2 size={16} className="animate-spin" /> Memproses...</> : <><Save size={16}/> Simpan Transaksi</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
