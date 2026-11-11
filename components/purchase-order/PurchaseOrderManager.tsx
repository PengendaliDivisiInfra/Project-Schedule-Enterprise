"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, Plus, X, Truck, CheckCircle, AlertTriangle, Info, Edit, Trash2, XCircle, EyeOff, Wallet, CreditCard, Undo2, Calculator, Keyboard } from 'lucide-react';
import { 
  getPurchaseOrders, 
  createPurchaseOrder, 
  updatePurchaseOrder, 
  deletePurchaseOrder, 
  getVendors, 
  receiveGoods, 
  recordPOPayment, // <-- Ganti dari markPOAsPaid
  voidPOPayment 
} from '@/lib/services/purchase-order-service';
import { useRole } from '@/lib/hooks/useRole';
import type { PurchaseOrder, Vendor, POItem } from '@/types/purchase-order';

export function PurchaseOrderManager({ projectId }: { projectId: string }) {
  const { can } = useRole(projectId);

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Buat/Edit PO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [poNumber, setPoNumber] = useState('');
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
  
  // State Manual Input
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualUnit, setManualUnit] = useState('');

  // State Modal Penerimaan Barang
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPoForReceipt, setSelectedPoForReceipt] = useState<PurchaseOrder | null>(null);
  const [doNumber, setDoNumber] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptQtys, setReceiptQtys] = useState<{ [itemId: string]: string }>({});
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);

  // State Modal Pembayaran & Pembatalan
  const [confirmPay, setConfirmPay] = useState<{ show: boolean; po: PurchaseOrder | null } | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  
  // STATE BARU UNTUK FORM BAYAR
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Transfer Bank');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');

  const [confirmVoid, setConfirmVoid] = useState<{ show: boolean; po: PurchaseOrder | null } | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  // State Custom Toast & Confirm Delete Modal
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
    if (!orderedQty || !unitPrice) return showToast("Qty dan Harga wajib diisi!", "error");
    
    if (isManualInput) {
      if (!manualName || !manualUnit) return showToast("Nama dan Satuan material manual wajib diisi!", "error");
      
      const newItem: POItem = {
        hsd_id: '',
        ordered_qty: Number(orderedQty),
        received_qty: 0,
        unit_price: Number(unitPrice),
        total_price: Number(orderedQty) * Number(unitPrice),
        is_manual: true,
        manual_name: manualName,
        manual_unit: manualUnit,
        master_hsd: { nama_item: manualName, satuan: manualUnit }
      };
      setPoItems([...poItems, newItem]);
      setManualName(''); setManualUnit(''); setOrderedQty(''); setUnitPrice('');
    } else {
      if (!selectedHsdId) return showToast("Pilih material terlebih dahulu!", "error");
      const mat = materials.find(m => m.id === selectedHsdId);
      
      const newItem: POItem = {
        hsd_id: selectedHsdId,
        ordered_qty: Number(orderedQty),
        received_qty: 0,
        unit_price: Number(unitPrice),
        total_price: Number(orderedQty) * Number(unitPrice),
        is_manual: false,
        master_hsd: { nama_item: mat?.nama_item || 'Unknown', satuan: mat?.satuan || 'Unit' }
      };
      
      const existingIndex = poItems.findIndex(i => i.hsd_id === selectedHsdId && !i.is_manual);
      if (existingIndex >= 0) {
        const updatedItems = [...poItems];
        updatedItems[existingIndex].ordered_qty += Number(orderedQty);
        updatedItems[existingIndex].total_price = updatedItems[existingIndex].ordered_qty * updatedItems[existingIndex].unit_price;
        setPoItems(updatedItems);
      } else {
        setPoItems([...poItems, newItem]);
      }
      setSelectedHsdId(''); setOrderedQty(''); setUnitPrice('');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPoId(null);
    const generatedPo = `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    setPoNumber(generatedPo); 
    setVendorId('');
    setPoItems([]);
    setPoDate(new Date().toISOString().split('T')[0]);
    setIsManualInput(false);
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
    setIsManualInput(false);
    
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
      po_number: poNumber,
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

  // --- HANDLER PEMBAYARAN BARU ---
  const handleOpenPayModal = (po: PurchaseOrder) => {
    setConfirmPay({ show: true, po });
    const sisa = po.grand_total - (po.paid_amount || 0);
    setPayAmount(sisa.toString());
    setPayMethod('Transfer Bank');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
  };

  const handlePayPO = async () => {
    if (!confirmPay || !confirmPay.po) return;
    if (!payAmount || Number(payAmount) <= 0) return showToast("Nominal bayar tidak valid!", "error");
    
    const sisaTagihan = confirmPay.po.grand_total - (confirmPay.po.paid_amount || 0);
    if (Number(payAmount) > sisaTagihan) {
      return showToast(`Nominal melebihi sisa tagihan (Rp ${sisaTagihan.toLocaleString('id-ID')})`, "error");
    }

    setIsPaying(true);
    try {
      await recordPOPayment(
        confirmPay.po.id, 
        projectId, 
        Number(payAmount), 
        payMethod,
        payDate,
        confirmPay.po.po_number,
        confirmPay.po.paid_amount || 0,
        confirmPay.po.grand_total
      );
      showToast('Realisasi pembayaran berhasil dicatat!');
      setConfirmPay(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const handleVoidPO = async () => {
    if (!confirmVoid || !confirmVoid.po) return;
    setIsVoiding(true);
    try {
      await voidPOPayment(confirmVoid.po.id, projectId, confirmVoid.po.paid_amount || 0, confirmVoid.po.po_number);
      showToast('Pembayaran Dibatalkan (Jurnal Pembalik Tercatat)!');
      setConfirmVoid(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsVoiding(false);
    }
  };


  return (
    <div className="space-y-4 relative">
      {/* TOAST */}
      {toast && toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border animate-in slide-in-from-top-2 fade-in ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
          <span className="font-semibold text-sm">{toast.msg}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" /> Purchase Order (PO)
          </h3>
          <p className="text-sm text-slate-500">Kelola pengadaan material dan tracking penerimaan barang.</p>
        </div>
        {can('CREATE_PO') && (
          <button onClick={handleOpenCreateModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Buat PO Baru
          </button>
        )}
      </div>

      {/* TABLE LIST PO */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
              <th className="p-4 font-bold">No. PO & Progress</th>
              <th className="p-4 font-bold">Vendor</th>
              <th className="p-4 font-bold">Tanggal</th>
              <th className="p-4 font-bold text-right">Grand Total</th>
              <th className="p-4 font-bold text-center">Status PO</th>
              <th className="p-4 font-bold text-center">Status Bayar</th>
              <th className="p-4 font-bold text-center w-72">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Memuat data PO...</td></tr> : 
              pos.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Belum ada Purchase Order.</td></tr> :
              pos.map(po => {
                const hasReceipt = po.items?.some((i: any) => i.received_qty > 0);
                const isPaid = po.payment_status === 'Paid';
                
                const totalOrdered = po.items?.reduce((sum, i) => sum + i.ordered_qty, 0) || 0;
                const totalReceived = po.items?.reduce((sum, i) => sum + i.received_qty, 0) || 0;
                const progressPercent = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;
                
                return (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-mono font-semibold">{po.po_number}</div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 max-w-[120px]">
                        <div 
                          className={`h-1.5 rounded-full ${progressPercent === 100 ? 'bg-emerald-500' : progressPercent > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} 
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {totalReceived} / {totalOrdered} Diterima
                      </div>
                    </td>
                    <td className="p-4 font-medium">{po.vendor?.name}</td>
                    <td className="p-4 text-slate-500">{new Date(po.po_date).toLocaleDateString('id-ID')}</td>
                    
                    <td className="p-4 text-right font-mono font-bold text-slate-700">
                      {can('VIEW_PRICE') ? (
                        `Rp ${po.grand_total.toLocaleString('id-ID')}`
                      ) : (
                        <span className="text-slate-400 italic flex items-center justify-end gap-1">
                          <EyeOff className="w-3 h-3" /> Rp ***
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        po.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                        po.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {po.status}
                      </span>
                    </td>

                    {/* STATUS BAYAR UPDATE */}
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            po.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                            po.payment_status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' : 
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {po.payment_status === 'Partially Paid' ? 'Bayar Sebagian' : po.payment_status === 'Paid' ? 'Lunas' : 'Belum Bayar'}
                          </span>
                          
                          {(po.payment_status === 'Paid' || po.payment_status === 'Partially Paid') && can('VOID_PAYMENT') && (
                            <button 
                              onClick={() => setConfirmVoid({ show: true, po })} 
                              className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1" 
                              title="Batalkan Semua Pembayaran"
                            >
                              <Undo2 className="w-3 h-3" /> Void
                            </button>
                          )}
                        </div>
                        {po.payment_status !== 'Paid' && (
                          <span className="text-[10px] text-slate-500 font-semibold">
                            Sisa: Rp {(po.grand_total - (po.paid_amount || 0)).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {can('RECEIVE_PO') && (
                          <button onClick={() => handleOpenReceiptModal(po)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 text-xs font-semibold flex items-center gap-1 transition-colors" title="Terima Barang">
                            <Truck className="w-3 h-3" /> Terima
                          </button>
                        )}
                        
                        {!hasReceipt && can('EDIT_PO') && (
                          <button onClick={() => handleOpenEditModal(po)} className="text-amber-600 hover:bg-amber-50 p-1.5 rounded transition-colors" title="Edit PO">
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {!hasReceipt && can('DELETE_PO') && (
                          <button onClick={() => triggerDelete(po.id, po.po_number)} className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors" title="Hapus PO">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {po.payment_status !== 'Paid' && can('VIEW_PRICE') && (
                          <button onClick={() => handleOpenPayModal(po)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200 text-xs font-semibold flex items-center gap-1 transition-colors" title="Catat Pembayaran">
                            <Wallet className="w-3 h-3" /> Bayar
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

      {/* MODAL INPUT REALISASI PEMBAYARAN (BARU) */}
      {confirmPay && confirmPay.show && confirmPay.po && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b bg-emerald-50 flex justify-between items-center">
              <h2 className="font-bold text-emerald-800 flex items-center gap-2">
                <Wallet className="w-5 h-5" /> Realisasi Pembayaran PO
              </h2>
              <button onClick={() => setConfirmPay(null)} className="text-emerald-600 hover:text-emerald-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500 font-bold">Total PO</p>
                  <p className="font-mono font-bold text-slate-800">Rp {confirmPay.po.grand_total.toLocaleString('id-ID')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-rose-500 font-bold">Sisa Tagihan</p>
                  <p className="font-mono font-bold text-rose-700">Rp {(confirmPay.po.grand_total - (confirmPay.po.paid_amount || 0)).toLocaleString('id-ID')}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nominal Bayar (Rp) *</label>
                <input 
                  type="number" 
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)} 
                  className="w-full border rounded-md p-2 text-lg font-mono font-bold focus:ring-2 focus:ring-emerald-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Metode Bayar</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-emerald-500">
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Tunai">Tunai (Cash)</option>
                    <option value="Cek / Giro">Cek / Giro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Bayar</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-emerald-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">No. Referensi / Catatan</label>
                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-emerald-500" placeholder="Contoh: No. Transfer BCA-12345" />
              </div>
              
              <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200 flex gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <p>Sistem akan mencatat pengeluaran ini ke Arus Kas (Cash Out). Status PO akan berubah otomatis menjadi <b>Partially Paid</b> atau <b>Paid</b>.</p>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setConfirmPay(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border rounded-lg hover:bg-slate-100">Batal</button>
              <button onClick={handlePayPO} disabled={isPaying} className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-2">
                {isPaying ? 'Memproses...' : 'Simpan Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VOID & DELETE */}
      {confirmVoid && confirmVoid.show && confirmVoid.po && (
         <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
           <div className="p-6 text-center">
             <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <Undo2 className="w-8 h-8 text-rose-600" />
             </div>
             <h2 className="text-xl font-bold text-slate-800 mb-2">Batalkan Pembayaran?</h2>
             <p className="text-sm text-slate-500 mb-6">
               Anda akan membatalkan seluruh pembayaran PO <b>{confirmVoid.po.po_number}</b>.<br/>
               Nominal dibatalkan: <b>Rp {(confirmVoid.po.paid_amount || 0).toLocaleString('id-ID')}</b>.<br/><br/>
               <span className="text-xs text-rose-500 italic">*Sistem akan membuat Jurnal Pembalik (Uang Masuk) di Arus Kas dan mengembalikan status PO menjadi Belum Bayar.</span>
             </p>
             <div className="flex justify-center gap-3">
               <button onClick={() => setConfirmVoid(null)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full" disabled={isVoiding}>
                 Batal
               </button>
               <button onClick={handleVoidPO} disabled={isVoiding} className="px-5 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors w-full flex items-center justify-center gap-2">
                 {isVoiding ? 'Memproses...' : 'Ya, Batalkan'}
               </button>
             </div>
           </div>
         </div>
       </div>
      )}

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
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm text-slate-700">Tambah Material</h4>
                  <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button 
                      type="button"
                      onClick={() => setIsManualInput(false)}
                      className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${!isManualInput ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Calculator className="w-3 h-3" /> Master HSD
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsManualInput(true)}
                      className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${isManualInput ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Keyboard className="w-3 h-3" /> Input Manual
                    </button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-2 items-end">
                  {!isManualInput ? (
                    <div className="flex-1 w-full">
                      <label className="block text-xs text-slate-500 mb-1">Pilih Material</label>
                      <select value={selectedHsdId} onChange={e => handleSelectMaterial(e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-blue-500">
                        <option value="">-- Cari Material --</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.nama_item} ({m.satuan})</option>)}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="flex-[2] w-full">
                        <label className="block text-xs text-amber-600 font-bold mb-1">Nama Material Baru</label>
                        <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} className="w-full border-amber-300 border rounded p-2 text-sm focus:ring-1 focus:ring-amber-500 bg-amber-50" placeholder="cth: Paku 7cm" />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block text-xs text-amber-600 font-bold mb-1">Satuan</label>
                        <input type="text" value={manualUnit} onChange={e => setManualUnit(e.target.value)} className="w-full border-amber-300 border rounded p-2 text-sm focus:ring-1 focus:ring-amber-500 bg-amber-50" placeholder="cth: Kg" />
                      </div>
                    </>
                  )}

                  <div className="w-full md:w-24">
                    <label className="block text-xs text-slate-500 mb-1">Qty</label>
                    <input type="number" value={orderedQty} onChange={e => setOrderedQty(e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-blue-500" placeholder="0" />
                  </div>
                  {can('VIEW_PRICE') && (
                    <div className="w-full md:w-32">
                      <label className="block text-xs text-slate-500 mb-1">Harga Satuan</label>
                      <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-blue-500" placeholder="0" />
                    </div>
                  )}
                  <button type="button" onClick={handleAddItem} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded text-sm h-[38px] w-full md:w-auto font-bold">Tambah</button>
                </div>
                
                <div className="mt-4 bg-white rounded border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b">
                      <tr>
                        <th className="text-left py-2 px-3">Material</th>
                        <th className="text-right px-3">Qty</th>
                        {can('VIEW_PRICE') && <th className="text-right px-3">Harga</th>}
                        {can('VIEW_PRICE') && <th className="text-right px-3">Total</th>}
                        <th className="px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {poItems.length === 0 ? <tr><td colSpan={can('VIEW_PRICE') ? 5 : 3} className="text-center py-4 text-slate-400">Belum ada item</td></tr> :
                        poItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 font-medium">
                            {item.master_hsd?.nama_item}
                            {item.is_manual && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Manual</span>}
                          </td>
                          <td className="text-right px-3">{item.ordered_qty} {item.master_hsd?.satuan}</td>
                          {can('VIEW_PRICE') && (
                            <td className="text-right px-3 font-mono">Rp {item.unit_price.toLocaleString('id-ID')}</td>
                          )}
                          {can('VIEW_PRICE') && (
                            <td className="text-right px-3 font-mono font-bold">Rp {item.total_price.toLocaleString('id-ID')}</td>
                          )}
                          <td className="text-center px-3">
                            <button type="button" onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors">
                              <X className="w-4 h-4"/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {can('VIEW_PRICE') && (
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
              )}

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