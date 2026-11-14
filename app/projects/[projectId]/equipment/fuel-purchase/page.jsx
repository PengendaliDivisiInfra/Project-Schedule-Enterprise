'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingCart, Plus, X, Loader2, CheckCircle2, AlertTriangle, CheckCircle } from 'lucide-react';
import { getFuelPOs, createFuelPO } from '@/lib/services/equipment.service';
import { FuelReceiptModal } from '@/components/equipment/FuelReceiptModal'; // IMPORT MODAL BARU

export default function FuelPurchasePage({ params }) {
  const projectId = params.projectId;
  const [pos, setPos] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [tanks, setTanks] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // State untuk Penerimaan BBM
  const [selectedPOForReceipt, setSelectedPOForReceipt] = useState(null);

  const [formData, setFormData] = useState({
    po_number: '', vendor_id: '', tank_id: '', 
    order_date: new Date().toISOString().split('T')[0], expected_date: '',
    total_volume: '', price_per_liter: ''
  });

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [posData, vendorsData, tanksData] = await Promise.all([
        getFuelPOs(projectId),
        supabase.from('vendors').select('id, name').eq('project_id', projectId).eq('is_active', true),
        supabase.from('fuel_tanks').select('id, tank_name').eq('project_id', projectId)
      ]);
      setPos(posData || []);
      setVendors(vendorsData.data || []);
      setTanks(tanksData.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { fetchData(); }, [projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login berakhir.");

      const vol = Number(formData.total_volume);
      const price = Number(formData.price_per_liter);

      await createFuelPO({
        project_id: projectId,
        tank_id: formData.tank_id,
        vendor_id: formData.vendor_id,
        po_number: formData.po_number,
        order_date: formData.order_date,
        expected_date: formData.expected_date,
        total_volume: vol,
        price_per_liter: price,
        total_amount: vol * price
      }, user.id);

      showToast('PO BBM berhasil dibuat!', 'success');
      setIsModalOpen(false);
      setFormData({ ...formData, po_number: '', total_volume: '', price_per_liter: '' });
      fetchData();
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6 animate-in fade-in">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ShoppingCart className="text-indigo-600" /> Pengadaan BBM (PO)</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola pembelian BBM dari supplier ke tangki induk.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
          <Plus size={18} /> Buat PO BBM
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-300">
                <th className="p-4 font-bold">No. PO</th>
                <th className="p-4 font-bold">Vendor</th>
                <th className="p-4 font-bold">Tangki Tujuan</th>
                <th className="p-4 font-bold text-right">Volume (L)</th>
                <th className="p-4 font-bold text-right">Harga / L</th>
                <th className="p-4 font-bold text-right">Total Nilai</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loadingData ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />Memuat data...</td></tr>
              ) : pos.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-400 italic">Belum ada PO BBM.</td></tr>
              ) : (
                pos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-indigo-700">{p.po_number}</td>
                    <td className="p-4 font-medium text-slate-800">{p.vendors?.name || '-'}</td>
                    <td className="p-4 text-slate-600">{p.fuel_tanks?.tank_name || '-'}</td>
                    <td className="p-4 text-right font-mono">{Number(p.total_volume).toFixed(0)} L</td>
                    <td className="p-4 text-right font-mono">{formatCurrency(p.price_per_liter)}</td>
                    <td className="p-4 text-right font-mono font-bold">{formatCurrency(p.total_amount)}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.status}</span>
                    </td>
                    <td className="p-4 text-center">
                      {p.status !== 'Completed' && (
                        <button onClick={() => setSelectedPOForReceipt(p)} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto transition-colors">
                          <CheckCircle size={14} /> Terima
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM PO BBM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200/60">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-indigo-600" /> Form PO BBM</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">No. PO BBM</label>
                    <input type="text" required value={formData.po_number} onChange={e => setFormData({...formData, po_number: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm font-semibold" placeholder="Contoh: PO/BBM/2026/001" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Supplier / Vendor</label>
                    <select required value={formData.vendor_id} onChange={e => setFormData({...formData, vendor_id: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm font-semibold bg-white">
                      <option value="">-- Pilih Vendor --</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Tanggal PO</label>
                    <input type="date" required value={formData.order_date} onChange={e => setFormData({...formData, order_date: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Estimasi Kedatangan</label>
                    <input type="date" required value={formData.expected_date} onChange={e => setFormData({...formData, expected_date: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Tangki Tujuan</label>
                    <select required value={formData.tank_id} onChange={e => setFormData({...formData, tank_id: e.target.value})} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm font-semibold bg-white">
                      <option value="">-- Pilih Tangki --</option>
                      {tanks.map(t => <option key={t.id} value={t.id}>{t.tank_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Volume (Liter)</label>
                    <input type="number" required value={formData.total_volume} onChange={e => setFormData({...formData, total_volume: e.target.value})} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm font-mono font-bold" placeholder="Liter" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Harga / Liter</label>
                    <input type="number" required value={formData.price_per_liter} onChange={e => setFormData({...formData, price_per_liter: e.target.value})} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm font-mono font-bold" placeholder="Rp" />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3 mt-auto">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border rounded-xl">Batal</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 className="w-4 h-4" /> Simpan PO</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PANGGIL MODAL PENERIMAAN BBM */}
      <FuelReceiptModal 
        isOpen={!!selectedPOForReceipt}
        onClose={() => setSelectedPOForReceipt(null)}
        poId={selectedPOForReceipt?.id || ''}
        poNumber={selectedPOForReceipt?.po_number || ''}
        projectId={projectId}
        onSuccess={() => fetchData()}
      />
    </div>
  );
}