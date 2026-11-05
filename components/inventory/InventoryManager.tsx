"use client";
import { useEffect, useState } from 'react';
import { Package, ArrowDownToLine, ArrowUpFromLine, Search, AlertCircle, X, CheckCircle } from 'lucide-react';
import { getInventoryStock, recordTransaction } from '@/lib/services/inventory-service';
import type { InventoryItem } from '@/types/inventory';

export function InventoryManager({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // State Modal Transaksi
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'IN' | 'OUT'>('IN');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // State Form
  const [qty, setQty] = useState('');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  const showToast = (msg: string, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await getInventoryStock(projectId);
      setItems(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  const handleOpenModal = (item: InventoryItem, type: 'IN' | 'OUT') => {
    setSelectedItem(item);
    setModalType(type);
    setQty('');
    setRef('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !qty || Number(qty) <= 0) return;
    
    setIsSaving(true);
    try {
      await recordTransaction(
        projectId, 
        selectedItem.hsd_id, 
        modalType, 
        Number(qty), 
        ref || (modalType === 'IN' ? 'Penerimaan' : 'Pemakaian'), 
        notes
      );
      showToast(`Berhasil mencatat barang ${modalType === 'IN' ? 'masuk' : 'keluar'}!`);
      setIsModalOpen(false);
      await loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.master_hsd?.nama_item.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <span className="font-semibold text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" /> Stok Gudang & Material
          </h3>
          <p className="text-sm text-slate-500">Catat barang masuk/keluar. Sisa stok akan otomatis memotong kebutuhan pengadaan.</p>
        </div>
        <div className="relative group w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
          <input 
            type="text" 
            placeholder="Cari nama material..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
              <th className="p-4 font-bold">Nama Material</th>
              <th className="p-4 font-bold text-center">Satuan</th>
              <th className="p-4 font-bold text-right bg-emerald-50 text-emerald-700">Stok Saat Ini</th>
              <th className="p-4 font-bold text-right text-rose-600">Stok Min.</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-center">Aksi Transaksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Memuat data stok...</td></tr>
            ) : filteredItems.map((item) => {
              const isLow = item.stok_on_hand <= item.stok_minimum;
              return (
                <tr key={item.hsd_id} className="hover:bg-slate-50">
                  <td className="p-4 font-semibold text-slate-800">{item.master_hsd?.nama_item}</td>
                  <td className="p-4 text-center text-slate-600">{item.master_hsd?.satuan}</td>
                  <td className="p-4 text-right font-mono font-bold text-lg text-emerald-700 bg-emerald-50/30">
                    {item.stok_on_hand.toLocaleString('id-ID')}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-500">{item.stok_minimum}</td>
                  <td className="p-4 text-center">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-bold">
                        <AlertCircle className="w-3 h-3" /> Menipis
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                        <CheckCircle className="w-3 h-3" /> Aman
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => handleOpenModal(item, 'IN')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-semibold transition-colors"
                      >
                        <ArrowDownToLine className="w-3 h-3" /> Masuk
                      </button>
                      <button 
                        onClick={() => handleOpenModal(item, 'OUT')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-xs font-semibold transition-colors"
                      >
                        <ArrowUpFromLine className="w-3 h-3" /> Keluar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL TRANSAKSI */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className={`flex justify-between items-center px-6 py-4 border-b border-slate-200 ${modalType === 'IN' ? 'bg-blue-50' : 'bg-amber-50'}`}>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {modalType === 'IN' ? <ArrowDownToLine className="w-5 h-5 text-blue-600" /> : <ArrowUpFromLine className="w-5 h-5 text-amber-600" />}
                Catat Barang {modalType === 'IN' ? 'Masuk' : 'Keluar'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white/50 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="bg-white p-3 border rounded-lg">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Material</p>
                  <p className="font-semibold text-slate-800 text-lg">{selectedItem.master_hsd?.nama_item}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah ({selectedItem.master_hsd?.satuan}) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={qty} 
                    onChange={(e) => setQty(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-md text-lg font-mono font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. Referensi (PO / Surat Jalan)</label>
                  <input 
                    type="text" 
                    value={ref} 
                    onChange={(e) => setRef(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                    placeholder={modalType === 'IN' ? 'Contoh: PO-2026-001' : 'Contoh: Pemakaian Harian'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Tambahan</label>
                  <textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                    rows={2}
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border rounded-md">Batal</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className={`px-5 py-2 text-sm font-bold text-white rounded-md shadow-sm disabled:opacity-50 ${modalType === 'IN' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}