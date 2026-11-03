'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, X, Loader2, Save, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function CashFlowPage() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    type: 'OUT', category: 'Material', description: '', amount: 0, transaction_date: new Date().toISOString().split('T')[0]
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFlows = async () => {
    setLoading(true);
    const { data } = await supabase.from('cash_flows').select('*').order('transaction_date', { ascending: false });
    if (data) setFlows(data);
    setLoading(false);
  };

  useEffect(() => { fetchFlows(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload = { ...formData, amount: Number(formData.amount) };
    const { error } = await supabase.from('cash_flows').insert([payload]);
    
    if (error) {
      alert("Gagal menyimpan: " + error.message);
    } else {
      setIsModalOpen(false);
      showToast('success', 'Transaksi berhasil disimpan!');
      setFormData({ type: 'OUT', category: 'Material', description: '', amount: 0, transaction_date: new Date().toISOString().split('T')[0] });
      fetchFlows();
    }
    setIsSaving(false);
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
                  <th className="p-3 w-32">Tanggal</th>
                  <th className="p-3 w-24 text-center">Tipe</th>
                  <th className="p-3 w-40">Kategori</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 w-48 text-right">Nominal (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flows.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic">Belum ada data transaksi keuangan.</td></tr>
                )}
                {flows.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{new Date(f.transaction_date).toLocaleDateString('id-ID')}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                        f.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>{f.type === 'IN' ? 'MASUK' : 'KELUAR'}</span>
                    </td>
                    <td className="p-3 text-slate-700 font-semibold">{f.category}</td>
                    <td className="p-3 text-slate-600 truncate max-w-xs">{f.description || '-'}</td>
                    <td className={`p-3 text-right font-bold ${f.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {f.type === 'IN' ? '+' : '-'} {formatRp(f.amount)}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-indigo-600"/> Tambah Transaksi Keuangan</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              
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

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  {formData.type === 'IN' ? (
                    <>
                      <option value="DP">Uang Muka (DP)</option>
                      <option value="Termin">Termin Pembayaran</option>
                      <option value="Retensi">Pencairan Retensi</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  ) : (
                    <>
                      <option value="Material">Pembelian Material</option>
                      <option value="Upah">Upah Tenaga Kerja</option>
                      <option value="Alat">Sewa Alat Berat</option>
                      <option value="Operasional">Biaya Operasional</option>
                      <option value="Subkon">Pembayaran Subkon</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nominal (Rp)</label>
                <input required type="number" min="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" onFocus={(e) => e.target.select()} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Keterangan</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="cth: Pembayaran termin 1 / Beli besi 10mm" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16}/> Simpan Transaksi</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
