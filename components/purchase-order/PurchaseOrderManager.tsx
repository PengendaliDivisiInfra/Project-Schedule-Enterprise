"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, Plus, X, Truck, CheckCircle, AlertTriangle, Info, Edit, Trash2, XCircle } from 'lucide-react';
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, getVendors, receiveGoods } from '@/lib/services/purchase-order-service';
import type { PurchaseOrder, Vendor, POItem } from '@/types/purchase-order';

export function PurchaseOrderManager({ projectId }: { projectId: string }) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Buat/Edit PO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [poNumber, setPoNumber] = useState(''); // State Baru untuk No. PO
  const [vendorId, setVendorId] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [shippingAddress, setShippingAddress] = useState(''); 
  const [ppnPercent, setPpnPercent] = useState(11);
  const [pphPercent, setPphPercent] = useState(1.5);
  
  // State Item PO
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [selectedHsdId, setSelectedHsdId] = useState('');
  const [orderedQty, setOrderedQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  
  // State Modal Penerimaan
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPoForReceipt, setSelectedPoForReceipt] = useState<PurchaseOrder | null>(null);
  const [doNumber, setDoNumber] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptQtys, setReceiptQtys] = useState<{ [itemId: string]: string }>({});
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);

  // State Custom Toast & Confirm Modal
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; poId: string; poNumber: string } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [poData, vendorData, { data: hsdData }] = await Promise.all([
        getPurchaseOrders(projectId),
        getVendors(projectId),
        supabase.from('master_hsd').select('id, nama_item, satuan, harga_dasar').in('tipe', ['bahan', 'material', 'Bahan'])
      ]);
      setPos(poData);
      setVendors(vendorData);
      setMaterials(hsdData || []);

      const { data: projectData } = await supabase.from('projects').select('name, location').eq('id', projectId).single();
      if (projectData) setShippingAddress(`${projectData.name} - ${projectData.location}`);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  // KALKULASI PAJAK
  const subtotal = poItems.reduce((acc, item) => acc + item.total_price, 0);
  const ppnAmount = (subtotal * ppnPercent) / 100;
  const pphAmount = (subtotal * pphPercent) / 100;
  const grandTotal = subtotal + ppnAmount - pphAmount;

  const handleSelectMaterial = (id: string) => {
    setSelectedHsdId(id);
    const mat = materials.find(m => m.id === id);
    if (mat && mat.harga_dasar) setUnitPrice(mat.harga_dasar.toString());
    else setUnitPrice('');
  };

  const handleAddItem = () => {
    if (!selectedHsdId || !orderedQty || !unitPrice) return;
    const mat = materials.find(m => m.id === selectedHsdId);
    
    const newItem: POItem = {
      hsd_id: selectedHsdId,
      ordered_qty: Number(orderedQty),
      received_qty: 0,
      unit_price: Number(unitPrice),
      total_price: Number(orderedQty) * Number(unitPrice),
      master_hsd: { nama_item: mat?.nama_item || 'Unknown', satuan: mat?.satuan || 'Unit' }
    };
    
    const existingIndex = poItems.findIndex(i => i.hsd_id === selectedHsdId);
    if (existingIndex >= 0) {
      const updatedItems = [...poItems];
      updatedItems[existingIndex].ordered_qty += Number(orderedQty);
      updatedItems[existingIndex].total_price = updatedItems[existingIndex].ordered_qty * updatedItems[existingIndex].unit_price;
      setPoItems(updatedItems);
    } else {
      setPoItems([...poItems, newItem]);
    }
    setSelectedHsdId(''); setOrderedQty(''); setUnitPrice('');
  };

  // --- MODAL OPEN (CREATE / EDIT) ---
  const handleOpenCreateModal = () => {
    setEditingPoId(null);
    // Generate No. PO otomatis sebagai saran awal
    const generatedPo = `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    setPoNumber(generatedPo); 
    setVendorId('');
    setPoItems([]);
    setPoDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (po: PurchaseOrder) => {
    setEditingPoId(po.id);
    setPoNumber(po.po_number);
    setVendorId(po.vendor_id);
    setPoDate(po.po_date);
    setShippingAddress(po.shipping_address || '');
    setPpnPercent(po.ppn_percent);
    setPphPercent(po.pph_percent);
    
    const mappedItems: POItem[] = (po.items || []).map((item: any) => ({
      hsd_id: item.hsd_id || '', 
      ordered_qty: item.ordered_qty,
      received_qty: item.received_qty,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.ordered_qty,
      master_hsd: item.master_hsd
    }));
    setPoItems(mappedItems);
    setIsModalOpen(true);
  };

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || poItems.length === 0) return showToast("Vendor dan minimal 1 Item harus diisi!", "error");
    if (!poNumber) return showToast("Nomor PO wajib diisi!", "error");

    const header: Partial<PurchaseOrder> = {
      project_id: projectId,
      vendor_id: vendorId,
      po_number: poNumber, // Menggunakan No. PO dari input user
      po_date: poDate,
      status: 'Ordered',
      subtotal,
      ppn_percent: ppnPercent,
      ppn_amount: ppnAmount,
      pph_percent: pphPercent,
      pph_amount: pphAmount,
      grand_total: grandTotal,
      shipping_address: shippingAddress
    };

    try {
      if (editingPoId) {
        await updatePurchaseOrder(editingPoId, header, poItems);
        showToast('PO Berhasil Diperbarui!');
      } else {
        await createPurchaseOrder(header, poItems);
        showToast('PO Berhasil Dibuat!');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // FUNGSI HAPUS (Memicu Modal Konfirmasi)
  const triggerDelete = (poId: string, poNumber: string) => {
    setConfirmDelete({ show: true, poId, poNumber });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePurchaseOrder(confirmDelete.poId);
      showToast('PO Berhasil Dihapus');
      setConfirmDelete(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
      setConfirmDelete(null);
    }
  };

  const handleOpenReceiptModal = (po: PurchaseOrder) => {
    setSelectedPoForReceipt(po);
    setDoNumber('');
    setReceiptNotes('');
    setReceiptQtys({});
    setIsReceiptModalOpen(true);
  };

  const handleReceiptChange = (itemId: string, val: string, maxQty: number) => {
    const num = Number(val);
    if (num > maxQty) return showToast(`Maksimal penerimaan adalah ${maxQty}`, "error");
    setReceiptQtys({ ...receiptQtys, [itemId]: val });
  };

  const handleSaveReceipt = async () => {
    if (!selectedPoForReceipt || !selectedPoForReceipt.id) return;
    if (!doNumber) return showToast("Nomor Surat Jalan (DO) wajib diisi!", "error");

    const itemsToReceive = Object.keys(receiptQtys).filter(id => Number(receiptQtys[id]) > 0);
    if (itemsToReceive.length === 0) return showToast("Isi minimal 1 jumlah penerimaan barang.", "error");

    setIsSavingReceipt(true);
    try {
      for (const itemId of itemsToReceive) {
        const qty = Number(receiptQtys[itemId]);
        await receiveGoods(selectedPoForReceipt.id, itemId, qty, doNumber, receiptNotes, projectId);
      }
      showToast('Penerimaan Barang Berhasil Dicatat!');
      setIsReceiptModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingReceipt(false);
    }
  };

  return (
    <div className="space-y-4 relative">
      {/* CUSTOM TOAST NOTIFICATION */}
      {toast && toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border animate-in slide-in-from-top-2 fade-in ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
          <span className="font-semibold text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" /> Purchase Order (PO)
          </h3>
          <p className="text-sm text-slate-500">Kelola pengadaan material dan tracking penerimaan barang.</p>
        </div>
        <button onClick={handleOpenCreateModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Buat PO Baru
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
              <th className="p-4 font-bold">No. PO</th>
              <th className="p-4 font-bold">Vendor</th>
              <th className="p-4 font-bold">Tanggal</th>
              <th className="p-4 font-bold text-right">Grand Total</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-center w-64">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Memuat data PO...</td></tr> : 
              pos.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Belum ada Purchase Order.</td></tr> :
              pos.map(po => {
                const hasReceipt = po.items?.some((i: any) => i.received_qty > 0);
                return (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-semibold">{po.po_number}</td>
                    <td className="p-4 font-medium">{po.vendor?.name}</td>
                    <td className="p-4 text-slate-500">{new Date(po.po_date).toLocaleDateString('id-ID')}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-700">Rp {po.grand_total.toLocaleString('id-ID')}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        po.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                        po.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenReceiptModal(po)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 text-xs font-semibold flex items-center gap-1 transition-colors">
                          <Truck className="w-3 h-3" /> Terima
                        </button>
                        
                        {!hasReceipt && (
                          <button onClick={() => handleOpenEditModal(po)} className="text-amber-600 hover:bg-amber-50 p-1.5 rounded transition-colors" title="Edit PO">
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {!hasReceipt && (
                          <button onClick={() => triggerDelete(po.id, po.po_number)} className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors" title="Hapus PO">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>

      {/* MODAL CUSTOM KONFIRMASI HAPUS */}
      {confirmDelete && confirmDelete.show && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Hapus Purchase Order?</h2>
              <p className="text-sm text-slate-500 mb-6">
                Anda akan menghapus <b>{confirmDelete.poNumber}</b>. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setConfirmDelete(null)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full">
                  Batal
                </button>
                <button onClick={executeDelete} className="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors w-full">
                  Ya, Hapus PO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUAT/EDIT PO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-8">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50 rounded-t-xl">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600"/> {editingPoId ? 'Edit Purchase Order' : 'Buat Purchase Order'}
              </h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSavePO} className="p-6 space-y-6">
              {/* UPDATE: Grid 3 kolom untuk No PO, Vendor, Tanggal */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. PO *</label>
                  <input 
                    type="text" 
                    value={poNumber} 
                    onChange={e => setPoNumber(e.target.value)} 
                    className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 font-mono font-bold" 
                    placeholder="PO-2026-XXXX"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Vendor *</label>
                  <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" required>
                    <option value="">Pilih Vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal PO *</label>
                  <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Alamat Pengiriman (Site)</label>
                <input type="text" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 bg-slate-50" />
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-bold text-sm text-slate-700 mb-3">Tambah Material</h4>
                <div className="flex flex-col md:flex-row gap-2 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-slate-500 mb-1">Pilih Material</label>
                    <select value={selectedHsdId} onChange={e => handleSelectMaterial(e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-blue-500">
                      <option value="">-- Cari Material --</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.nama_item} ({m.satuan})</option>)}
                    </select>
                  </div>
                  <div className="w-full md:w-24">
                    <label className="block text-xs text-slate-500 mb-1">Qty</label>
                    <input type="number" value={orderedQty} onChange={e => setOrderedQty(e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-blue-500" placeholder="0" />
                  </div>
                  <div className="w-full md:w-40">
                    <label className="block text-xs text-slate-500 mb-1">Harga Satuan (Rp)</label>
                    <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-blue-500" placeholder="0" />
                  </div>
                  <button type="button" onClick={handleAddItem} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded text-sm h-[38px] w-full md:w-auto">Tambah</button>
                </div>
                
                <div className="mt-4 bg-white rounded border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b"><tr><th className="text-left py-2 px-3">Material</th><th className="text-right px-3">Qty</th><th className="text-right px-3">Harga</th><th className="text-right px-3">Total</th><th className="px-3"></th></tr></thead>
                    <tbody>
                      {poItems.length === 0 ? <tr><td colSpan={5} className="text-center py-4 text-slate-400">Belum ada item</td></tr> :
                        poItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-2 px-3 font-medium">{item.master_hsd?.nama_item}</td>
                          <td className="text-right px-3">{item.ordered_qty} {item.master_hsd?.satuan}</td>
                          <td className="text-right px-3 font-mono">Rp {item.unit_price.toLocaleString('id-ID')}</td>
                          <td className="text-right px-3 font-mono font-bold">Rp {item.total_price.toLocaleString('id-ID')}</td>
                          <td className="text-center px-3"><button type="button" onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700"><X className="w-4 h-4"/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full md:w-1/2 space-y-2 text-sm bg-white p-4 rounded-lg border shadow-sm">
                  <div className="flex justify-between"><span>Subtotal:</span> <span className="font-mono">Rp {subtotal.toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between items-center text-blue-600">
                    <span>PPN <input type="number" value={ppnPercent} onChange={e => setPpnPercent(Number(e.target.value))} className="w-12 border-b border-blue-300 text-center bg-transparent focus:outline-none" />%:</span> 
                    <span className="font-mono">+ Rp {ppnAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-600">
                    <span>PPh <input type="number" value={pphPercent} onChange={e => setPphPercent(Number(e.target.value))} className="w-12 border-b border-amber-300 text-center bg-transparent focus:outline-none" />%:</span> 
                    <span className="font-mono">- Rp {pphAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2 text-slate-800 mt-2">
                    <span>Grand Total:</span> 
                    <span className="font-mono">Rp {grandTotal.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm font-semibold hover:bg-slate-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold shadow-sm">
                  {editingPoId ? 'Simpan Revisi PO' : 'Simpan PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PENERIMAAN BARANG */}
      {isReceiptModalOpen && selectedPoForReceipt && (
         <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
             <div className="p-4 border-b bg-slate-50 flex justify-between rounded-t-xl items-center">
               <h2 className="font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-blue-600" /> Penerimaan Barang: {selectedPoForReceipt.po_number}</h2>
               <button onClick={() => setIsReceiptModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500"/></button>
             </div>
             
             <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">No. Surat Jalan / DO *</label>
                    <input type="text" value={doNumber} onChange={e => setDoNumber(e.target.value)} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" placeholder="Contoh: SJ-001" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Catatan</label>
                    <input type="text" value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" placeholder="Kondisi barang, dll" />
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden mt-4">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase border-b">
                      <tr>
                        <th className="p-3 font-bold">Material</th>
                        <th className="p-3 font-bold text-center">Qty PO</th>
                        <th className="p-3 font-bold text-center">Sisa (Outstanding)</th>
                        <th className="p-3 font-bold text-center bg-blue-50 text-blue-700 w-32">Qty Diterima</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPoForReceipt.items?.map((item: any) => {
                        const outstanding = item.ordered_qty - item.received_qty;
                        return (
                          <tr key={item.id}>
                            <td className="p-3 font-medium">
                              {item.master_hsd?.nama_item} 
                              <span className="text-slate-400 text-xs ml-1">({item.master_hsd?.satuan})</span>
                            </td>
                            <td className="p-3 text-center font-mono">{item.ordered_qty}</td>
                            <td className="p-3 text-center font-mono font-bold text-amber-600">{outstanding}</td>
                            <td className="p-3 text-center bg-blue-50/30">
                              {outstanding > 0 ? (
                                <input 
                                  type="number" 
                                  min="0"
                                  max={outstanding}
                                  value={receiptQtys[item.id] || ''} 
                                  onChange={e => handleReceiptChange(item.id, e.target.value, outstanding)}
                                  className="w-full border border-blue-300 rounded p-1.5 text-center font-mono font-bold text-blue-700 focus:ring-1 focus:ring-blue-500"
                                  placeholder="0"
                                />
                              ) : (
                                <span className="text-emerald-600 font-bold text-xs flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> Lunas</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800 flex gap-2 mt-4">
                  <Info className="w-5 h-5 shrink-0" />
                  <p>Sistem akan otomatis menambahkan stok ke Gudang dan mengubah status PO menjadi <b>Partial</b> atau <b>Completed</b> secara dinamis.</p>
                </div>
             </div>

             <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-xl">
                <button onClick={() => setIsReceiptModalOpen(false)} className="px-4 py-2 border rounded text-sm font-semibold hover:bg-slate-100">Batal</button>
                <button 
                  onClick={handleSaveReceipt} 
                  disabled={isSavingReceipt || !doNumber}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-semibold shadow-sm flex items-center gap-2"
                >
                  {isSavingReceipt ? 'Menyimpan...' : <><CheckCircle className="w-4 h-4"/> Simpan Penerimaan</>}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}