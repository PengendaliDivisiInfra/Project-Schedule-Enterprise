"use client";
import { useEffect, useState } from 'react';
import { Package, ArrowDownToLine, ArrowUpFromLine, Search, AlertCircle, X, CheckCircle, History, Edit3, ShieldAlert, Box, Link as LinkIcon, Plus, Save, Trash2 } from 'lucide-react';
import { getInventoryStock, recordTransaction, getMaterialHistory, updateTransaction, updateStokMinimum, getGlobalLedger, createMasterMaterial, getMaterialPOs, voidTransaction } from '@/lib/services/inventory-service';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/hooks/useRole'; // TAMBAHAN RBAC
import type { InventoryItem, InventoryTransaction } from '@/types/inventory';

export function InventoryManager({ projectId }: { projectId: string }) {
  // RBAC HOOK
  const { can } = useRole(projectId);
  const canEdit = can('EDIT_INVENTORY'); // Menggunakan permission key standar

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [wbsList, setWbsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Mode Tampilan
  const [viewMode, setViewMode] = useState<'stock' | 'ledger'>('ledger'); 
  const [globalLedger, setGlobalLedger] = useState<any[]>([]);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'IN' | 'OUT'>('IN');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // Form States Transaksi
  const [qty, setQty] = useState('');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [poRef, setPoRef] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [selectedWbs, setSelectedWbs] = useState<string>(''); 
  const [resourceType, setResourceType] = useState<string>('Material'); 
  const [isSaving, setIsSaving] = useState(false);

  // State PO Dropdown
  const [materialPOs, setMaterialPOs] = useState<any[]>([]);

  // State Pilih Material & Buat Baru
  const [showMaterialSelect, setShowMaterialSelect] = useState(false);
  const [searchMaterial, setSearchMaterial] = useState('');
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);
  const [newMatForm, setNewMatForm] = useState({ nama_item: '', satuan: 'Kg', harga_dasar: 0, kategori_akun: 'Material Utama' });

  // History & Edit
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<InventoryTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [editingTrx, setEditingTrx] = useState<InventoryTransaction | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  // Stok Min
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
      const { data: tasks } = await supabase.from('wbs_tasks').select('id, wbs_code, name').eq('project_id', projectId).eq('summary', 'No').order('wbs_code');
      const ledger = await getGlobalLedger(projectId);
      
      setItems(data);
      setWbsList(tasks || []);
      setGlobalLedger(ledger);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  const getResourceTypeFromCategory = (category?: string) => {
    if (category === 'Alat Bantu') return 'Equipment';
    if (category === 'Consumable' || category === 'Material Bantu') return 'Consumable';
    return 'Material';
  };

  const handleOpenModal = async (item: InventoryItem, type: 'IN' | 'OUT') => {
    setSelectedItem(item);
    setModalType(type);
    setQty(''); setRef(''); setNotes(''); setPoRef(''); setInvoiceNo('');
    setSelectedWbs(''); 
    setResourceType(getResourceTypeFromCategory(item.master_hsd?.kategori_akun));
    
    try {
      const pos = await getMaterialPOs(projectId, item.hsd_id);
      setMaterialPOs(pos);
    } catch (e) {
      setMaterialPOs([]);
    }
    
    setIsModalOpen(true);
  };

  const handleOpenTransactionFromLedger = () => {
    setShowMaterialSelect(true);
    setSearchMaterial('');
    setIsCreatingMaterial(false);
    setNewMatForm({ nama_item: '', satuan: 'Kg', harga_dasar: 0, kategori_akun: 'Material Utama' });
  };

  const handleSelectMaterial = (item: InventoryItem, type: 'IN' | 'OUT') => {
    setShowMaterialSelect(false);
    handleOpenModal(item, type);
  };

  const handleCreateNewMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatForm.nama_item.trim()) return showToast("Nama material wajib diisi!", "error");
    setIsSaving(true);
    try {
      const newHsd = await createMasterMaterial({ ...newMatForm, project_id: projectId });
      showToast('Material baru berhasil ditambahkan!');
      await loadData();
      
      const newItem = {
        id: '', project_id: projectId, hsd_id: newHsd.id, stok_on_hand: 0, stok_minimum: 0,
        lokasi_gudang: 'Gudang Utama', updated_at: new Date().toISOString(),
        master_hsd: { nama_item: newHsd.nama_item, satuan: newHsd.satuan, harga_dasar: newHsd.harga_dasar, tipe: newHsd.tipe, kategori_akun: newHsd.kategori_akun, spesifikasi: newHsd.spesifikasi }
      };
      
      setShowMaterialSelect(false);
      handleOpenModal(newItem, 'IN');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !qty || Number(qty) <= 0) return showToast("Jumlah harus lebih besar dari 0!", "error");
    
    setIsSaving(true);
    try {
      const taskId = modalType === 'OUT' && selectedWbs !== 'OVERHEAD' ? selectedWbs : null;
      await recordTransaction(
        projectId, selectedItem.hsd_id, modalType, Number(qty), 
        ref || (modalType === 'IN' ? 'Penerimaan' : 'Pemakaian'), notes, 
        taskId, resourceType, poRef, invoiceNo
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

  const handleOpenHistory = async (item: InventoryItem) => {
    if (!item.id) return showToast("Belum ada stok/transaksi untuk material ini.", "error");
    setSelectedItem(item); setIsHistoryOpen(true); setLoadingHistory(true);
    try { setHistoryData(await getMaterialHistory(item.id)); } catch (e: any) { showToast(e.message, 'error'); } finally { setLoadingHistory(false); }
  };

  const handleOpenEditTrx = (trx: InventoryTransaction) => {
    if (trx.reference?.includes('PO') || trx.notes?.includes('Penerimaan')) {
      return showToast("Transaksi dari PO/BBM tidak bisa diedit di sini.", "error");
    }
    setEditingTrx(trx); setEditQty(trx.quantity.toString()); setEditNotes(trx.notes || '');
    setShowVoidConfirm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingTrx) return;
    if (!editQty || Number(editQty) <= 0) return showToast("Jumlah koreksi harus lebih besar dari 0!", "error");
    
    setIsUpdating(true);
    try {
      await updateTransaction(editingTrx.id, Number(editQty), editNotes, editingTrx.quantity, editingTrx.type, editingTrx.inventory_id);
      showToast('Transaksi berhasil direvisi!'); setEditingTrx(null); await loadData();
      if (isHistoryOpen && selectedItem) setHistoryData(await getMaterialHistory(selectedItem.id));
    } catch (e: any) { showToast(e.message, 'error'); } finally { setIsUpdating(false); }
  };

  const handleVoidTransaction = async () => {
    if (!editingTrx) return;
    setIsVoiding(true);
    try {
      await voidTransaction(editingTrx.id, editingTrx.inventory_id, editingTrx.quantity, editingTrx.type);
      showToast('Transaksi berhasil dibatalkan (Void) & stok dikembalikan!');
      setEditingTrx(null); 
      await loadData();
      if (isHistoryOpen && selectedItem) setHistoryData(await getMaterialHistory(selectedItem.id));
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  const handleOpenEditMin = (item: InventoryItem) => { setEditMinItem(item); setMinValue(item.stok_minimum.toString()); setIsEditMinOpen(true); };
  const handleSaveMin = async () => {
    if (!editMinItem) return; setIsSavingMin(true);
    try { await updateStokMinimum(editMinItem.id, editMinItem.hsd_id, projectId, Number(minValue)); showToast('Stok minimum diperbarui!'); setIsEditMinOpen(false); loadData(); } 
    catch (e: any) { showToast(e.message, 'error'); } finally { setIsSavingMin(false); }
  };

  const filteredItems = items.filter(i => i.master_hsd?.nama_item.toLowerCase().includes(search.toLowerCase()));
  const filteredLedger = globalLedger.filter(i => i.inventory_materials?.master_hsd?.nama_item.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="space-y-4">
        {toast.show && (
          <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
            <span className="font-semibold text-sm">{toast.msg}</span>
          </div>
        )}

        {/* HEADER & TABS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Package className="w-5 h-5 text-blue-600" /> Manajemen Gudang</h3>
            <p className="text-sm text-slate-500">Kelola stok fisik dan pantau mutasi barang.</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
              <button onClick={() => setViewMode('ledger')} className={`flex-1 md:flex-none justify-center px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'ledger' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}><History className="w-4 h-4" /> Buku Besar (Ledger)</button>
              <button onClick={() => setViewMode('stock')} className={`flex-1 md:flex-none justify-center px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'stock' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}><Box className="w-4 h-4" /> Stok Fisik</button>
            </div>
            <div className="relative group w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
              <input type="text" placeholder="Cari material..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* VIEW: BUKU BESAR (LEDGER) */}
        {viewMode === 'ledger' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h4 className="font-bold text-slate-700">Buku Besar Mutasi Material & BBM</h4>
              {/* RBAC: TOMBOL TAMBAH HANYA UNTUK YANG BERHAK */}
              {canEdit && (
                <button onClick={handleOpenTransactionFromLedger} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
                  <Plus className="w-4 h-4" /> Tambah Transaksi Manual
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-800 text-white text-xs uppercase border-b">
                  <tr>
                    <th className="p-3 font-bold text-center">No</th>
                    <th className="p-3 font-bold">Tanggal</th>
                    <th className="p-3 font-bold text-center">Tipe</th>
                    <th className="p-3 font-bold">No. PO</th>
                    <th className="p-3 font-bold">No. SJ / Invoice</th>
                    <th className="p-3 font-bold">Deskripsi Material</th>
                    <th className="p-3 font-bold">Spesifikasi</th>
                    <th className="p-3 font-bold text-center">Satuan</th>
                    <th className="p-3 font-bold">Pekerjaan / Alat</th>
                    <th className="p-3 font-bold text-right text-emerald-400">IN</th>
                    <th className="p-3 font-bold text-right text-rose-400">OUT</th>
                    <th className="p-3 font-bold">Keterangan</th>
                    <th className="p-3 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={13} className="p-8 text-center text-slate-500">Memuat buku besar...</td></tr>
                  ) : filteredLedger.length === 0 ? (
                    <tr><td colSpan={13} className="p-8 text-center text-slate-500">Belum ada mutasi barang.</td></tr>
                  ) : filteredLedger.map((trx, idx) => {
                    const isPO = trx.reference?.includes('PO') || trx.notes?.includes('Penerimaan');
                    return (
                    <tr key={trx.id} className="hover:bg-slate-50">
                      <td className="p-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="p-3 text-slate-600">{new Date(trx.transaction_date).toLocaleDateString('id-ID')}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${trx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{trx.type}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{trx.po_reference || '-'}</td>
                      <td className="p-3 font-mono text-slate-600">{trx.invoice_number || trx.reference || '-'}</td>
                      <td className="p-3 font-semibold text-slate-800">{trx.inventory_materials?.master_hsd?.nama_item}</td>
                      <td className="p-3 text-slate-500">{trx.inventory_materials?.master_hsd?.spesifikasi || '-'}</td>
                      <td className="p-3 text-center text-slate-500">{trx.inventory_materials?.master_hsd?.satuan}</td>
                      <td className="p-3 text-slate-600">
                        {trx.notes?.includes('Isi BBM') ? <span className="text-blue-600 font-bold">{trx.notes.split('(')[0]}</span> : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">{trx.type === 'IN' ? trx.quantity : '-'}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">{trx.type === 'OUT' ? trx.quantity : '-'}</td>
                      <td className="p-3 text-xs text-slate-500 max-w-[200px] truncate" title={trx.notes}>{trx.notes}</td>
                      <td className="p-3 text-center">
                        {/* RBAC: TOMBOL EDIT HANYA UNTUK YANG BERHAK */}
                        {isPO ? (
                          <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded" title="Locked"><ShieldAlert className="w-3 h-3 inline"/></span>
                        ) : canEdit ? (
                          <button onClick={() => handleOpenEditTrx(trx)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Koreksi / Void"><Edit3 className="w-4 h-4" /></button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic font-semibold">Read-Only</span>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW: STOK FISIK */}
        {viewMode === 'stock' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
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
                      <td className="p-4 text-right font-mono font-bold text-lg text-emerald-700 bg-emerald-50/30">{item.stok_on_hand.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right font-mono text-slate-500">
                        {canEdit ? (
                          <button onClick={() => handleOpenEditMin(item)} className="hover:text-blue-600 flex items-center justify-end gap-1 w-full">{item.stok_minimum} <Edit3 className="w-3 h-3 opacity-50" /></button>
                        ) : (
                          <span>{item.stok_minimum}</span>
                        )}
                      </td>
                      <td className="p-4 text-center">{isLow ? <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-bold"><AlertCircle className="w-3 h-3 inline mr-1"/>Menipis</span> : <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold"><CheckCircle className="w-3 h-3 inline mr-1"/>Aman</span>}</td>
                      <td className="p-4"><div className="flex justify-center gap-2">
                        {canEdit ? (
                          <>
                            <button onClick={() => handleOpenModal(item, 'IN')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-semibold"><ArrowDownToLine className="w-3 h-3" /> Masuk</button>
                            <button onClick={() => handleOpenModal(item, 'OUT')} className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-xs font-semibold"><ArrowUpFromLine className="w-3 h-3" /> Keluar</button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-semibold bg-slate-100 px-2 py-1 rounded-md">Read-Only</span>
                        )}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODALS (SAMA SEPERTI SEBELUMNYA, TETAP LENGKAP) --- */}
      {/* MODAL PILIH MATERIAL / TAMBAH BARU */}
      {showMaterialSelect && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-800 text-white shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> {isCreatingMaterial ? 'Buat Material Baru' : 'Pilih Material untuk Transaksi'}</h2>
              <button onClick={() => { setShowMaterialSelect(false); setIsCreatingMaterial(false); }} className="text-slate-400 hover:text-white bg-slate-700 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>

            {!isCreatingMaterial ? (
              <>
                <div className="p-4 border-b flex gap-2">
                  <input type="text" placeholder="Cari material..." value={searchMaterial} onChange={e => setSearchMaterial(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  <button onClick={() => setIsCreatingMaterial(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap flex items-center gap-1 shadow-sm">
                    <Plus className="w-4 h-4"/> Material Baru
                  </button>
                </div>
                <div className="p-0 overflow-y-auto flex-1">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {items.filter(i => i.master_hsd?.nama_item.toLowerCase().includes(searchMaterial.toLowerCase())).map((item) => (
                        <tr key={item.hsd_id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-800">{item.master_hsd?.nama_item}</td>
                          <td className="p-3 text-slate-500 text-right">{item.master_hsd?.satuan}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleSelectMaterial(item, 'IN')} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200">IN</button>
                              <button onClick={() => handleSelectMaterial(item, 'OUT')} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold hover:bg-amber-200">OUT</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {items.filter(i => i.master_hsd?.nama_item.toLowerCase().includes(searchMaterial.toLowerCase())).length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-500">
                            Material tidak ditemukan. <button onClick={() => { setNewMatForm({...newMatForm, nama_item: searchMaterial}); setIsCreatingMaterial(true); }} className="text-blue-600 font-bold underline ml-1">Buat "{searchMaterial}" sekarang?</button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <form onSubmit={handleCreateNewMaterial} className="p-6 flex flex-col gap-4">
                <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-200">
                  Material yang dibuat di sini akan otomatis ditambahkan ke Master HSD dengan tipe 'Bahan'.
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Material *</label>
                  <input type="text" required autoFocus value={newMatForm.nama_item} onChange={e => setNewMatForm({...newMatForm, nama_item: e.target.value})} className="w-full px-4 py-2 border rounded-lg font-semibold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Contoh: Kawat Bendrat" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Satuan *</label>
                    <select value={newMatForm.satuan} onChange={e => setNewMatForm({...newMatForm, satuan: e.target.value})} className="w-full px-4 py-2 border rounded-lg bg-white outline-none">
                      <option value="Kg">Kg</option>
                      <option value="M3">M3</option>
                      <option value="M2">M2</option>
                      <option value="M1">M1</option>
                      <option value="Liter">Liter</option>
                      <option value="Buah">Buah</option>
                      <option value="Unit">Unit</option>
                      <option value="Ls">Ls</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Harga Satuan *</label>
                    <input type="number" required value={newMatForm.harga_dasar} onChange={e => setNewMatForm({...newMatForm, harga_dasar: Number(e.target.value)})} className="w-full px-4 py-2 border rounded-lg font-mono outline-none" placeholder="Rp" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kategori Akun (Untuk P&L)</label>
                  <select value={newMatForm.kategori_akun} onChange={e => setNewMatForm({...newMatForm, kategori_akun: e.target.value})} className="w-full px-4 py-2 border rounded-lg bg-white outline-none">
                    <option value="Material Utama">Material Utama (HPP)</option>
                    <option value="Consumable">Consumable (Overhead)</option>
                    <option value="Material Bantu">Material Bantu (Overhead)</option>
                    <option value="Alat Bantu">Alat Bantu (Overhead)</option>
                  </select>
                </div>
                
                <div className="pt-4 border-t flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setIsCreatingMaterial(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg">Batal</button>
                  <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md flex items-center gap-2">
                    {isSaving ? 'Menyimpan...' : <><Save className="w-4 h-4"/> Simpan & Lanjut Transaksi</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL TRANSAKSI BARU (IN/OUT) */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className={`flex justify-between items-center px-6 py-4 border-b border-slate-200 ${modalType === 'IN' ? 'bg-blue-50' : 'bg-amber-50'}`}>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">{modalType === 'IN' ? <ArrowDownToLine className="w-5 h-5 text-blue-600" /> : <ArrowUpFromLine className="w-5 h-5 text-amber-600" />} Catat Manual ({modalType})</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white/50 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="bg-slate-50 p-3 border rounded-lg">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Material</p>
                  <p className="font-semibold text-slate-800 text-lg">{selectedItem.master_hsd?.nama_item}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah ({selectedItem.master_hsd?.satuan}) *</label>
                  <input type="number" min="0.01" step="0.01" required value={qty} onChange={(e) => setQty(e.target.value)} className="w-full px-3 py-2 border rounded-md text-lg font-mono font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="0.00" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {selectedItem.master_hsd?.kategori_akun === 'Material Utama' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">No. PO (Opsional)</label>
                      <select value={poRef} onChange={(e) => setPoRef(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">-- Tanpa PO / Stok Awal --</option>
                        {materialPOs.map(po => (
                          <option key={po.id} value={po.po_number}>{po.po_number}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-end pb-2">
                       <span className="text-xs text-slate-400 italic font-medium">*Pembelian Non-PO (Petty Cash)</span>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">No. Invoice / SJ</label>
                    <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="INV-XXX" />
                  </div>
                </div>

                {modalType === 'OUT' && (
                  <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Beban Biaya Ke:</label>
                      <select value={selectedWbs} onChange={(e) => setSelectedWbs(e.target.value)} required className="w-full px-3 py-2 border border-amber-200 rounded-md text-sm font-semibold bg-white focus:ring-2 focus:ring-amber-500/20 outline-none">
                        <option value="">-- Pilih Tujuan --</option>
                        <option value="OVERHEAD" className="font-bold text-blue-700">🔵 Overhead Proyek (Non-WBS)</option>
                        <optgroup label="Pekerjaan WBS (Direct Cost)">
                          {wbsList.map(w => <option key={w.id} value={w.id}>{w.wbs_code} - {w.name}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-800 mb-1">Tipe Biaya (Auto-Select):</label>
                      <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="w-full px-3 py-2 border border-amber-200 rounded-md text-sm bg-white outline-none">
                        <option value="Material">Material Utama (HPP)</option>
                        <option value="Consumable">Consumable (Overhead)</option>
                        <option value="Material Bantu">Material Bantu (Overhead)</option>
                        <option value="Equipment">Alat Bantu (Overhead)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Tambahan</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" rows={2} />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border rounded-md">Batal</button>
                <button type="submit" disabled={isSaving || (modalType === 'OUT' && !selectedWbs)} className={`px-5 py-2 text-sm font-bold text-white rounded-md shadow-sm disabled:opacity-50 ${modalType === 'IN' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}</button>
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
                    const isPO = trx.reference?.includes('PO') || trx.notes?.includes('Penerimaan');
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
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded" title="Transaksi PO tidak bisa diedit di sini"><ShieldAlert className="w-3 h-3" /> Locked</span>
                          ) : canEdit ? (
                            <button onClick={() => handleOpenEditTrx(trx)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 mx-auto"><Edit3 className="w-3 h-3" /> Koreksi</button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic font-semibold">Read-Only</span>
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

      {/* NESTED MODAL: EDIT & VOID TRANSAKSI */}
      {editingTrx && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 flex flex-col">
            <div className="p-4 border-b bg-amber-50 flex justify-between items-center">
              <h3 className="font-bold text-amber-800 flex items-center gap-2"><Edit3 className="w-4 h-4"/> Koreksi Transaksi</h3>
              <button onClick={() => setEditingTrx(null)} className="text-amber-500 hover:text-amber-700"><X className="w-5 h-5"/></button>
            </div>
            
            {!showVoidConfirm ? (
              <div className="p-4 space-y-3">
                <div className="bg-slate-50 p-2 rounded text-xs text-slate-500">Data Lama: <b>{editingTrx.type === 'IN' ? 'Masuk' : 'Keluar'} {editingTrx.quantity}</b></div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah Baru ({selectedItem?.master_hsd?.satuan}) *</label>
                  <input type="number" min="0.01" step="0.01" required value={editQty} onChange={e => setEditQty(e.target.value)} className="w-full border p-2 rounded-md font-mono font-bold focus:ring-1 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Alasan Revisi / Catatan Baru</label>
                  <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full border p-2 rounded-md text-sm focus:ring-1 focus:ring-amber-500 outline-none" rows={2} placeholder="Contoh: Salah ketik 100 jadi 10" />
                </div>
                <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /> Stok utama akan otomatis bertambah/berkurang sesuai selisih koreksi.</div>
                
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">Salah pilih material? Batalkan transaksi ini dan input ulang.</p>
                  <button onClick={() => setShowVoidConfirm(true)} className="w-full px-4 py-2 text-sm font-bold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 rounded-lg flex justify-center items-center gap-2 transition-colors">
                    <Trash2 className="w-4 h-4" /> Batalkan Transaksi (Void)
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2"><ShieldAlert className="w-8 h-8 text-rose-600" /></div>
                <h3 className="text-lg font-bold text-slate-800">Yakin Membatalkan?</h3>
                <p className="text-sm text-slate-600">Transaksi akan dihapus dari Buku Besar dan stok akan dikembalikan ke posisi semula. Tindakan ini tidak bisa dibatalkan.</p>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setShowVoidConfirm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg">Kembali</button>
                  <button onClick={handleVoidTransaction} disabled={isVoiding} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-2 shadow-sm">
                    {isVoiding ? 'Memproses...' : 'Ya, Batalkan'}
                  </button>
                </div>
              </div>
            )}

            {!showVoidConfirm && (
              <div className="p-3 border-t bg-slate-50 flex justify-end gap-2 mt-auto">
                <button onClick={() => setEditingTrx(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border rounded-md">Batal</button>
                <button onClick={handleSaveEdit} disabled={isUpdating} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-md shadow-sm">{isUpdating ? 'Menyimpan...' : 'Simpan Koreksi'}</button>
              </div>
            )}
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
                <input type="number" value={minValue} onChange={e => setMinValue(e.target.value)} className="w-full border rounded-md p-2 font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setIsEditMinOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border rounded-lg">Batal</button>
              <button onClick={handleSaveMin} disabled={isSavingMin} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">{isSavingMin ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}