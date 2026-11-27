'use client';

import { useEffect, useState } from 'react';
import {
  FilePlus2,
  CheckCircle2,
  XCircle,
  ArrowRightCircle,
  Plus,
  Trash2,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/hooks/useRole';
import {
  listPurchaseRequests,
  createPurchaseRequest,
  updatePurchaseRequestStatus,
  convertPrToPo,
} from '@/lib/services/supply-chain.service';
import { getWbsBudget3Layer, type WbsBudget3LayerRow } from '@/lib/services/budget-control.service';
import { getVendors } from '@/lib/services/purchase-order-service';

export function PurchaseRequestManager({ projectId }: { projectId: string }) {
  const { can } = useRole(projectId);
  const canApprove = can('APPROVE_PROCUREMENT') || can('APPROVE_FINANCE');

  const [prs, setPrs] = useState<any[]>([]);
  const [wbsList, setWbsList] = useState<WbsBudget3LayerRow[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prNumber, setPrNumber] = useState('');
  const [wbsCode, setWbsCode] = useState('');
  const [neededDate, setNeededDate] = useState('');
  const [justification, setJustification] = useState('');
  const [items, setItems] = useState<
    Array<{ hsd_id: string; item_name: string; unit: string; requested_qty: number; estimated_unit_price: number }>
  >([{ hsd_id: '', item_name: '', unit: 'Unit', requested_qty: 1, estimated_unit_price: 0 }]);

  // Convert PR -> PO modal
  const [convertTarget, setConvertTarget] = useState<any | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [poNumberInput, setPoNumberInput] = useState('');
  const [converting, setConverting] = useState(false);

  const emitToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message } }));
    }
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [prData, budgetData, vendorData, hsdRes] = await Promise.all([
        listPurchaseRequests(projectId),
        getWbsBudget3Layer(projectId).catch(() => []),
        getVendors(projectId).catch(() => []),
        supabase.from('master_hsd').select('id, nama_item, satuan, harga_dasar').in('tipe', ['bahan', 'material', 'Bahan']),
      ]);
      setPrs(prData || []);
      setWbsList(budgetData || []);
      setVendors(vendorData || []);
      setMaterials(hsdRes.data || []);
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memuat Purchase Request.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const openCreate = () => {
    setPrNumber(`PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setWbsCode('');
    setNeededDate(new Date().toISOString().split('T')[0]);
    setJustification('');
    setItems([{ hsd_id: '', item_name: '', unit: 'Unit', requested_qty: 1, estimated_unit_price: 0 }]);
    setCreateOpen(true);
  };

  const estimatedTotal = items.reduce(
    (sum, it) => sum + Number(it.requested_qty || 0) * Number(it.estimated_unit_price || 0),
    0
  );

  const selectedWbs = wbsList.find((w) => w.wbs_code === wbsCode);

  const handleSavePr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prNumber.trim()) return emitToast('error', 'Nomor PR wajib diisi.');
    const validItems = items.filter((i) => i.item_name.trim() && Number(i.requested_qty) > 0);
    if (validItems.length === 0) return emitToast('error', 'Tambahkan minimal 1 item material.');

    setSaving(true);
    try {
      await createPurchaseRequest(
        {
          project_id: projectId,
          pr_number: prNumber.trim(),
          wbs_code: wbsCode || null,
          needed_date: neededDate || null,
          justification,
          estimated_total: estimatedTotal,
        },
        validItems.map((i) => ({
          hsd_id: i.hsd_id || null,
          item_name: i.item_name.trim(),
          unit: i.unit.trim() || 'Unit',
          requested_qty: Number(i.requested_qty),
          estimated_unit_price: Number(i.estimated_unit_price),
          estimated_total: Number(i.requested_qty) * Number(i.estimated_unit_price),
        }))
      );
      emitToast('success', `Purchase Request ${prNumber} berhasil diajukan!`);
      setCreateOpen(false);
      loadData();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menyimpan PR.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (prId: string, status: 'Approved' | 'Rejected') => {
    try {
      await updatePurchaseRequestStatus(prId, projectId, status);
      emitToast('success', `PR berhasil diubah menjadi ${status}.`);
      loadData();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memperbarui status PR.');
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertTarget || !selectedVendorId || !poNumberInput.trim()) {
      return emitToast('error', 'Pilih Vendor dan isi Nomor PO.');
    }
    setConverting(true);
    try {
      await convertPrToPo({
        pr: convertTarget,
        vendorId: selectedVendorId,
        poNumber: poNumberInput.trim(),
      });
      emitToast('success', `PR ${convertTarget.pr_number} berhasil dikonversi menjadi PO ${poNumberInput}!`);
      setConvertTarget(null);
      loadData();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal konversi PR ke PO.');
    } finally {
      setConverting(false);
    }
  };

  const formatRp = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FilePlus2 className="w-5 h-5 text-indigo-600" /> Purchase Request (PR) — Document Chaining
          </h3>
          <p className="text-sm text-slate-500">
            Alur resmi: <b>RAB/WBS → Purchase Request (PR) → Purchase Order (PO) → GRN → Vendor Invoice</b>.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Buat Purchase Request
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
            <tr>
              <th className="p-4 font-bold">No. PR &amp; Tanggal</th>
              <th className="p-4 font-bold">Relasi WBS</th>
              <th className="p-4 font-bold">Item &amp; Alasan</th>
              <th className="p-4 font-bold text-right">Estimasi Total</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Memuat data PR...
                </td>
              </tr>
            ) : prs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                  Belum ada Purchase Request untuk proyek ini.
                </td>
              </tr>
            ) : (
              prs.map((pr) => (
                <tr key={pr.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-mono font-bold text-slate-800">{pr.pr_number}</div>
                    <div className="text-xs text-slate-400">{pr.request_date}</div>
                  </td>
                  <td className="p-4 font-mono text-xs text-indigo-700 font-bold">{pr.wbs_code || '-'}</td>
                  <td className="p-4 text-xs">
                    <div className="font-semibold text-slate-700">{(pr.items || []).length} item material</div>
                    <div className="text-slate-500 truncate max-w-xs">{pr.justification || '-'}</div>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-800">{formatRp(pr.estimated_total)}</td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        pr.status === 'Converted_to_PO'
                          ? 'bg-indigo-100 text-indigo-700'
                          : pr.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : pr.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {pr.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {pr.status === 'Pending' && canApprove && (
                        <>
                          <button
                            onClick={() => handleStatusChange(pr.id, 'Approved')}
                            className="px-2.5 py-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded text-xs font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                          </button>
                          <button
                            onClick={() => handleStatusChange(pr.id, 'Rejected')}
                            className="px-2.5 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded text-xs font-bold flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Tolak
                          </button>
                        </>
                      )}
                      {pr.status === 'Approved' && (
                        <button
                          onClick={() => {
                            setConvertTarget(pr);
                            setSelectedVendorId('');
                            setPoNumberInput(`PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" /> Konversi ke PO
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Buat PR */}
      {createOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-indigo-600" /> Buat Purchase Request (PR)
              </h2>
              <button onClick={() => setCreateOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSavePr} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. PR *</label>
                  <input required value={prNumber} onChange={(e) => setPrNumber(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Relasi WBS / RAB *</label>
                  <select value={wbsCode} onChange={(e) => setWbsCode(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                    <option value="">-- Pilih WBS --</option>
                    {wbsList.map((w) => (
                      <option key={w.wbs_code} value={w.wbs_code}>
                        [{w.wbs_code}] {w.task_name} (Avail: {formatRp(w.available_budget)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tgl Dibutuhkan</label>
                  <input type="date" value={neededDate} onChange={(e) => setNeededDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>

              {selectedWbs && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs flex flex-wrap justify-between gap-2">
                  <span className="font-bold text-indigo-800 flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Available Budget WBS [{selectedWbs.wbs_code}]:</span>
                  <span className="font-mono font-extrabold text-emerald-700">{formatRp(selectedWbs.available_budget)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Justifikasi / Keperluan Lapangan</label>
                <input value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="cth: Kebutuhan pengecoran minggu ke-12" className="w-full border rounded-lg p-2 text-sm" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">Daftar Material</label>
                  <button
                    type="button"
                    onClick={() => setItems([...items, { hsd_id: '', item_name: '', unit: 'Unit', requested_qty: 1, estimated_unit_price: 0 }])}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border">
                    <select
                      value={it.hsd_id}
                      onChange={(e) => {
                        const mat = materials.find((m) => m.id === e.target.value);
                        const next = [...items];
                        next[idx] = {
                          ...next[idx],
                          hsd_id: e.target.value,
                          item_name: mat?.nama_item || next[idx].item_name,
                          unit: mat?.satuan || next[idx].unit,
                          estimated_unit_price: Number(mat?.harga_dasar || next[idx].estimated_unit_price),
                        };
                        setItems(next);
                      }}
                      className="col-span-4 border rounded p-1.5 text-xs bg-white"
                    >
                      <option value="">-- Master HSD (Opsional) --</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>{m.nama_item}</option>
                      ))}
                    </select>
                    <input
                      required
                      placeholder="Nama Material"
                      value={it.item_name}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx].item_name = e.target.value;
                        setItems(next);
                      }}
                      className="col-span-3 border rounded p-1.5 text-xs bg-white"
                    />
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      placeholder="Qty"
                      value={it.requested_qty}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx].requested_qty = Number(e.target.value);
                        setItems(next);
                      }}
                      className="col-span-2 border rounded p-1.5 text-xs bg-white font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Est. Harga"
                      value={it.estimated_unit_price}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx].estimated_unit_price = Number(e.target.value);
                        setItems(next);
                      }}
                      className="col-span-2 border rounded p-1.5 text-xs bg-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))}
                      className="col-span-1 text-rose-500 hover:bg-rose-50 p-1 rounded flex justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="text-right font-bold text-sm text-slate-800 pt-2">
                  Estimasi Total PR: <span className="font-mono text-indigo-700">{formatRp(estimatedTotal)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Ajukan PR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konversi PR ke PO */}
      {convertTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleConvert} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg text-slate-800">Konversi {convertTarget.pr_number} ke PO</h3>
            <p className="text-xs text-slate-500">
              PO baru akan otomatis mewarisi relasi WBS <b>{convertTarget.wbs_code || '(Proyek)'}</b> dan melewati validasi <b>Hard-Stop Pessimistic Lock</b>.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nomor PO Baru *</label>
              <input required value={poNumberInput} onChange={(e) => setPoNumberInput(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Vendor *</label>
              <select required value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                <option value="">-- Pilih Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setConvertTarget(null)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={converting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {converting ? 'Memproses...' : 'Terbitkan PO'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
