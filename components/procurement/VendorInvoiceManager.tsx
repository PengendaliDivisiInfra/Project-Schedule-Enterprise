'use client';

import { useEffect, useState } from 'react';
import {
  FileCheck2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
  UploadCloud,
  Loader2,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useRole } from '@/lib/hooks/useRole';
import {
  listVendorInvoices,
  createVendorInvoiceWithThreeWayMatch,
  markVendorInvoicePaid,
} from '@/lib/services/supply-chain.service';
import { getPurchaseOrders, recordPOPayment } from '@/lib/services/purchase-order-service';
import { uploadPrivateFile } from '@/lib/utils/secure-storage';

export function VendorInvoiceManager({ projectId }: { projectId: string }) {
  const { can } = useRole(projectId);
  const canPay = can('APPROVE_FINANCE') || can('VIEW_PRICE');

  const [invoices, setInvoices] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [tolerancePct, setTolerancePct] = useState('1');
  const [invFile, setInvFile] = useState<File | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const emitToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message } }));
    }
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [invData, poData] = await Promise.all([
        listVendorInvoices(projectId),
        getPurchaseOrders(projectId),
      ]);
      setInvoices(invData || []);
      setPos(poData || []);
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memuat Vendor Invoice.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleSelectPo = (poId: string) => {
    setSelectedPoId(poId);
    const po = pos.find((p) => p.id === poId);
    if (!po) {
      setLines([]);
      return;
    }
    setLines(
      (po.items || []).map((it: any) => ({
        po_item_id: it.id,
        hsd_id: it.hsd_id,
        item_name: it.master_hsd?.nama_item || 'Material',
        ordered_qty: Number(it.ordered_qty || 0),
        received_qty: Number(it.received_qty || 0),
        po_unit_price: Number(it.unit_price || 0),
        invoiced_qty: Number(it.received_qty || it.ordered_qty || 0),
        invoiced_unit_price: Number(it.unit_price || 0),
      }))
    );
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const po = pos.find((p) => p.id === selectedPoId);
    if (!po || !invoiceNumber.trim() || lines.length === 0) {
      return emitToast('error', 'Pilih PO, isi Nomor Invoice, dan pastikan item tersedia.');
    }

    setSaving(true);
    try {
      let filePath: string | null = null;
      if (invFile) {
        const ext = invFile.name.split('.').pop() || 'pdf';
        filePath = await uploadPrivateFile(
          'evidence',
          `${projectId}/inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`,
          invFile
        );
      }

      const { matchResult } = await createVendorInvoiceWithThreeWayMatch({
        projectId,
        po,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        dueDate: dueDate || null,
        invoiceFilePath: filePath,
        priceTolerancePct: Number(tolerancePct) || 1.0,
        invoiceLines: lines,
      });

      if (matchResult.canApprovePayment) {
        emitToast('success', 'Vendor Invoice tersimpan & LULUS Three-Way Matching (Siap Dibayar)!');
      } else {
        emitToast('info', `Invoice tersimpan dengan status ${matchResult.status}. Periksa syarat Three-Way Matching.`);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menyimpan Vendor Invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprovePayment = async (inv: any) => {
    if (inv.three_way_status !== 'MATCHED') {
      return emitToast('error', 'Pembayaran terkunci: Syarat Three-Way Matching belum terpenuhi 100%.');
    }
    setPayingId(inv.id);
    try {
      const po = inv.purchase_order;
      await recordPOPayment(
        inv.po_id,
        projectId,
        Number(inv.invoiced_grand_total || 0),
        'Transfer Bank',
        new Date().toISOString().split('T')[0],
        po?.po_number || inv.invoice_number,
        Number(po?.paid_amount || 0),
        Number(po?.grand_total || inv.invoiced_grand_total || 0)
      );
      await markVendorInvoicePaid(inv.id, projectId);
      emitToast('success', `Pembayaran Invoice ${inv.invoice_number} disetujui & dicatat ke Arus Kas!`);
      loadData();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memproses pembayaran invoice.');
    } finally {
      setPayingId(null);
    }
  };

  const formatRp = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-600" /> Vendor Invoice &amp; Automated Three-Way Matching
          </h3>
          <p className="text-sm text-slate-500">
            Tombol <b>Approve Payment</b> otomatis terkunci hingga <b>1) Qty GRN = Invoice</b>, <b>2) Harga sesuai PO</b>, dan <b>3) Foto Surat Jalan + GPS/Timestamp</b> tervalidasi.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedPoId('');
            setInvoiceNumber('');
            setLines([]);
            setInvFile(null);
            setModalOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Input Vendor Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
            <tr>
              <th className="p-4 font-bold">No. Invoice &amp; PO</th>
              <th className="p-4 font-bold">Vendor</th>
              <th className="p-4 font-bold text-right">Nilai Tagihan</th>
              <th className="p-4 font-bold text-center">Checklist 3-Way Match</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-center">Aksi Finance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Memuat Vendor Invoice...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                  Belum ada Vendor Invoice yang tercatat.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const matched = inv.three_way_status === 'MATCHED';
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-mono font-bold text-slate-800">{inv.invoice_number}</div>
                      <div className="text-xs text-indigo-600 font-mono">PO: {inv.purchase_order?.po_number || '-'}</div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-700">{inv.vendor?.name || '-'}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800">
                      {formatRp(inv.invoiced_grand_total)}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap justify-center gap-1.5 text-[10px] font-bold">
                        <span className={`px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${inv.qty_match_ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {inv.qty_match_ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Qty GRN
                        </span>
                        <span className={`px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${inv.price_match_ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {inv.price_match_ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} Harga PO
                        </span>
                        <span className={`px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${inv.evidence_match_ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {inv.evidence_match_ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} SJ + GPS
                        </span>
                      </div>
                      {!matched && inv.match_notes && (
                        <p className="text-[10px] text-rose-600 text-center mt-1 max-w-xs mx-auto truncate" title={inv.match_notes}>
                          {inv.match_notes}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          inv.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : matched
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {inv.status === 'Paid' ? 'Paid (Lunas)' : inv.three_way_status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {inv.status === 'Paid' ? (
                        <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4" /> Lunas
                        </span>
                      ) : canPay ? (
                        <button
                          onClick={() => handleApprovePayment(inv)}
                          disabled={!matched || payingId === inv.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                            matched
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          }`}
                          title={matched ? 'Setujui & Catat Pembayaran' : 'Terkunci: 3-Way Matching belum lulus'}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          {payingId === inv.id ? 'Memproses...' : 'Approve Payment'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Hanya Finance/PM</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Input Vendor Invoice */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" /> Input Vendor Invoice &amp; Uji Three-Way Matching
              </h2>
              <button onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Purchase Order *</label>
                  <select required value={selectedPoId} onChange={(e) => handleSelectPo(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                    <option value="">-- Pilih PO --</option>
                    {pos.map((p) => (
                      <option key={p.id} value={p.id}>{p.po_number} ({p.vendor?.name || 'Vendor'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. Invoice Vendor *</label>
                  <input required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV/2026/001" className="w-full border rounded-lg p-2 text-sm font-mono font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Toleransi Harga (%)</label>
                  <input type="number" step="0.1" min={0} max={5} value={tolerancePct} onChange={(e) => setTolerancePct(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Invoice</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jatuh Tempo</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">File Faktur / Invoice (Private)</label>
                  <label className="cursor-pointer border rounded-lg px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4" />
                    <span className="truncate">{invFile ? invFile.name : 'Unggah PDF/Foto'}</span>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => setInvFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              </div>

              {lines.length > 0 && (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 uppercase border-b">
                      <tr>
                        <th className="p-2.5">Material</th>
                        <th className="p-2.5 text-center">Qty PO</th>
                        <th className="p-2.5 text-center">Qty GRN</th>
                        <th className="p-2.5 text-center">Qty Invoice</th>
                        <th className="p-2.5 text-right">Harga PO</th>
                        <th className="p-2.5 text-right">Harga Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lines.map((l, idx) => (
                        <tr key={l.po_item_id || idx}>
                          <td className="p-2.5 font-bold">{l.item_name}</td>
                          <td className="p-2.5 text-center font-mono">{l.ordered_qty}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-indigo-700">{l.received_qty}</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={l.invoiced_qty}
                              onChange={(e) => {
                                const next = [...lines];
                                next[idx].invoiced_qty = Number(e.target.value);
                                setLines(next);
                              }}
                              className="w-20 border rounded p-1 text-center font-mono"
                            />
                          </td>
                          <td className="p-2.5 text-right font-mono">{formatRp(l.po_unit_price)}</td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              min={0}
                              value={l.invoiced_unit_price}
                              onChange={(e) => {
                                const next = [...lines];
                                next[idx].invoiced_unit_price = Number(e.target.value);
                                setLines(next);
                              }}
                              className="w-28 border rounded p-1 text-right font-mono"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {saving ? 'Memvalidasi 3-Way Match...' : 'Simpan & Validasi Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
