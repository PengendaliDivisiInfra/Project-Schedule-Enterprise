"use client";
import { useEffect, useState } from 'react';
import { Package, ArrowDownToLine, ArrowUpFromLine, Search, AlertCircle, X, CheckCircle, History, Edit3, ShieldAlert } from 'lucide-react';
import { getInventoryStock, recordTransaction, getMaterialHistory, updateTransaction, updateStokMinimum } from '@/lib/services/inventory-service';
import type { InventoryItem, InventoryTransaction } from '@/types/inventory';

export function InventoryManager({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'IN' | 'OUT'>('IN');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  const [qty, setQty] = useState('');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<InventoryTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [editingTrx, setEditingTrx] = useState<InventoryTransaction | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // State Edit Stok Min
  const [isEditMinOpen, setIsEditMinOpen] = useState(false);
  const [editMinItem, setEditMinItem] = useState<InventoryItem | null>(null);
  const [minValue, setMinValue] = useState('');
  const [isSavingMin, setIsSavingMin] = useState(false);

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
      await recordTransaction(projectId, selectedItem.hsd_id, modalType, Number(qty), ref || (modalType === 'IN' ? 'Penerimaan' : 'Pemakaian'), notes);
      showToast(`Berhasil mencatat barang ${modalType === 'IN' ? 'masuk' : 'keluar'}!`);
      setIsModalOpen(false);
      await loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenHistory = async (item: InventoryItem) => {
    if (!item.id) return;
    setSelectedItem(item);
    setIsHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const history = await getMaterialHistory(item.id);
      setHistoryData(history);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenEditTrx = (trx: InventoryTransaction) => {
    if (trx.reference?.includes('Penerimaan PO') || trx.notes?.includes('Penerimaan PO')) {
      return showToast("Transaksi dari PO tidak bisa diedit di sini. Gunakan fitur VOID di menu PO.", "error");
    }
    setEditingTrx(trx);
    setEditQty(trx.quantity.toString());
    setEditNotes(trx.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTrx || !selectedItem || !selectedItem.id) return;
    setIsUpdating(true);
    try {
      await updateTransaction(editingTrx.id, Number(editQty), editNotes, editingTrx.quantity, editingTrx.type, selectedItem.id);
      showToast('Transaksi berhasil direvisi & stok disesuaikan!');
      setEditingTrx(null);
      await loadData();
      const newHistory = await getMaterialHistory(selectedItem.id);
      setHistoryData(newHistory);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handler Edit Stok Min
  const handleOpenEditMin = (item: InventoryItem) => {
    setEditMinItem(item);
    setMinValue(item.stok_minimum.toString());
    setIsEditMinOpen(true);
  };

  const handleSaveMin = async () => {
    if (!editMinItem) return;
    setIsSavingMin(true);
    try {
      await updateStokMinimum(editMinItem.id, editMinItem.hsd_id, projectId, Number(minValue));
      showToast('Batas minimum stok berhasil diperbarui!');
      setIsEditMinOpen(false);
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsSavingMin(false);
    }
  };

  const filteredItems = items.filter(i => i.master_hsd?.nama_item.toLowerCase().includes(search.toLowerCase()));

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
          <p className="text-sm text-slate-500">Klik nama material untuk melihat history, atau edit stok minimum.</p>
        </div>
        <div className="relative group w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
          <input type="text" placeholder="Cari nama material..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full focus:ring-1 focus:ring-blue-500" />
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
                <tr key={item.hsd_id} className="hover:bg-slate-50 group">
                  <td className="p-4">
                    <button onClick={() => handleOpenHistory(item)} className="font-semibold text-slate-800 hover:text-blue-600 hover:underline flex items-center gap-2 text-left transition-colors" title="Lihat History Material">
                      {item.master_hsd?.nama_item}
                      <History className="w-4 h-4 text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  </td>
                  <td className="p-4 text-center text-slate-600">{item.master_hsd?.satuan}</td>
                  <td className="p-4 text-right font-mono font-bold text-lg text-emerald-700 bg-emerald-50/30">
                    {item.stok_on_hand.toLocaleString('id-ID')}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-500">
                    <button onClick={() => handleOpenEditMin(item)} className="hover:text-blue-600 hover:underline flex items-center justify-end gap-1 w-full" title="Edit Stok Minimum">
                      {item.stok_minimum} <Edit3 className="w-3 h-3 opacity-50" />
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-bold"><AlertCircle className="w-3 h-3" /> Menipis</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold"><CheckCircle className="w-3 h-3" /> Aman</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(item, 'IN')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-semibold transition-colors"><ArrowDownToLine className="w-3 h-3" /> Masuk</button>
                      <button onClick={() => handleOpenModal(item, 'OUT')} className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-xs font-semibold transition-colors"><ArrowUpFromLine className="w-3 h-3" /> Keluar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL TRANSAKSI BARU (IN/OUT) */}
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
                  <input type="number" step="0.01" required value={qty} onChange={(e) => setQty(e.target.value)} className="w-full px-3 py-2 border rounded-md text-lg font-mono font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. Referensi (PO / Surat Jalan)</label>
                  <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder={modalType === 'IN' ? 'Contoh: PO-2026-001' : 'Contoh: Pemakaian Harian'} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Tambahan</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={2} />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border rounded-md">Batal</button>
                <button type="submit" disabled={isSaving} className={`px-5 py-2 text-sm font-bold text-white rounded-md shadow-sm disabled:opacity-50 ${modalType === 'IN' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORY (KARTU STOK) */}
      {isHistoryOpen && selectedItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-800 text-white shrink-0">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><History className="w-5 h-5" /> History: {selectedItem.master_hsd?.nama_item}</h2>
                <p className="text-xs text-slate-300">Total Stok Saat Ini: {selectedItem.stok_on_hand} {selectedItem.master_hsd?.satuan}</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-white bg-slate-700 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-0 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                  <tr className="text-slate-600 text-xs uppercase">
                    <th className="p-3 font-bold">Tanggal</th>
                    <th className="p-3 font-bold text-center">Tipe</th>
                    <th className="p-3 font-bold text-right">Jumlah</th>
                    <th className="p-3 font-bold">Referensi / Catatan</th>
                    <th className="p-3 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingHistory ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">Memuat history...</td></tr>
                  ) : historyData.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada history transaksi.</td></tr>
                  ) : historyData.map((trx) => {
                    const isPO = trx.reference?.includes('Penerimaan PO') || trx.notes?.includes('Penerimaan PO');
                    return (
                      <tr key={trx.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-600">{new Date(trx.transaction_date).toLocaleDateString('id-ID')}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${trx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{trx.type === 'IN' ? 'MASUK' : 'KELUAR'}</span>
                        </td>
                        <td className={`p-3 text-right font-mono font-bold ${trx.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>{trx.type === 'IN' ? '+' : '-'}{trx.quantity}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-700">{trx.reference || '-'}</div>
                          <div className="text-xs text-slate-500">{trx.notes}</div>
                        </td>
                        <td className="p-3 text-center">
                          {isPO ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded" title="Transaksi PO tidak bisa diedit di sini"><ShieldAlert className="w-3 h-3" /> Locked (PO)</span>
                          ) : (
                            <button onClick={() => handleOpenEditTrx(trx)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 mx-auto"><Edit3 className="w-3 h-3" /> Koreksi</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t bg-slate-50 text-right shrink-0">
              <button onClick={() => setIsHistoryOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-700 bg-white border rounded-md hover:bg-slate-100">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* NESTED MODAL: EDIT TRANSAKSI */}
      {editingTrx && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b bg-amber-50 flex justify-between items-center">
              <h3 className="font-bold text-amber-800 flex items-center gap-2"><Edit3 className="w-4 h-4"/> Koreksi Transaksi</h3>
              <button onClick={() => setEditingTrx(null)} className="text-amber-500 hover:text-amber-700"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-slate-50 p-2 rounded text-xs text-slate-500">Data Lama: <b>{editingTrx.type === 'IN' ? 'Masuk' : 'Keluar'} {editingTrx.quantity}</b></div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah Baru ({selectedItem?.master_hsd?.satuan}) *</label>
                <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} className="w-full border p-2 rounded-md font-mono font-bold focus:ring-1 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Alasan Revisi / Catatan Baru</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full border p-2 rounded-md text-sm focus:ring-1 focus:ring-amber-500" rows={2} placeholder="Contoh: Salah ketik 100 jadi 10" />
              </div>
              <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /> Stok utama akan otomatis bertambah/berkurang sesuai selisih koreksi.</div>
            </div>
            <div className="p-3 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setEditingTrx(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border rounded-md">Batal</button>
              <button onClick={handleSaveEdit} disabled={isUpdating} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-md shadow-sm">{isUpdating ? 'Menyimpan...' : 'Simpan Koreksi'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT STOK MINIMUM */}
      {isEditMinOpen && editMinItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b bg-blue-50 flex justify-between items-center">
              <h2 className="font-bold text-blue-800 flex items-center gap-2"><Edit3 className="w-4 h-4" /> Atur Stok Minimum</h2>
              <button onClick={() => setIsEditMinOpen(false)} className="text-blue-600 hover:text-blue-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-bold mb-1">Material</p>
                <p className="font-semibold text-slate-800">{editMinItem.master_hsd?.nama_item}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Batas Minimum Stok ({editMinItem.master_hsd?.satuan})</label>
                <input type="number" value={minValue} onChange={e => setMinValue(e.target.value)} className="w-full border rounded-md p-2 font-mono font-bold focus:ring-2 focus:ring-blue-500" placeholder="0" />
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setIsEditMinOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border rounded-lg">Batal</button>
              <button onClick={handleSaveMin} disabled={isSavingMin} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">{isSavingMin ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}