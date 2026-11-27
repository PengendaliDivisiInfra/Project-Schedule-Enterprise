'use client';

import { useEffect, useState } from 'react';
import {
  Warehouse,
  ArrowLeftRight,
  ClipboardCheck,
  Plus,
  CheckCircle2,
  Loader2,
  Building2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/hooks/useRole';
import {
  listWarehouses,
  createWarehouse,
  listMaterialTransfers,
  createMaterialTransfer,
  executeMaterialTransfer,
  listStockOpnames,
  createStockOpname,
  approveStockOpname,
} from '@/lib/services/supply-chain.service';
import { getInventoryStock } from '@/lib/services/inventory-service';
import { calculateStockOpnameVariance } from '@/lib/utils/supply-chain';

export function MultiWarehouseManager({ projectId }: { projectId: string }) {
  const { can } = useRole(projectId);
  const canApprove = can('APPROVE_PROCUREMENT') || can('APPROVE_FINANCE');

  const [subTab, setSubTab] = useState<'warehouses' | 'transfers' | 'opname'>('warehouses');
  const [loading, setLoading] = useState(true);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [opnames, setOpnames] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  // Modal Tambah Gudang
  const [whModal, setWhModal] = useState(false);
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whType, setWhType] = useState<'CENTRAL' | 'SITE'>('SITE');
  const [whLocation, setWhLocation] = useState('');
  const [whPic, setWhPic] = useState('');

  // Modal Material Transfer
  const [trModal, setTrModal] = useState(false);
  const [trNumber, setTrNumber] = useState('');
  const [trSourceType, setTrSourceType] = useState<'SITE' | 'CENTRAL'>('SITE');
  const [trTargetProjectId, setTrTargetProjectId] = useState('');
  const [trHsdId, setTrHsdId] = useState('');
  const [trQty, setTrQty] = useState('');
  const [trNotes, setTrNotes] = useState('');

  // Modal Stock Opname
  const [opModal, setOpModal] = useState(false);
  const [opNumber, setOpNumber] = useState('');
  const [opDate, setOpDate] = useState(new Date().toISOString().split('T')[0]);
  const [opNotes, setOpNotes] = useState('');
  const [opLines, setOpLines] = useState<any[]>([]);

  const [busy, setBusy] = useState(false);

  const emitToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message } }));
    }
  };

  const loadAll = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [whData, trData, opData, invData, projRes] = await Promise.all([
        listWarehouses(projectId),
        listMaterialTransfers(projectId),
        listStockOpnames(projectId),
        getInventoryStock(projectId).catch(() => []),
        supabase.from('projects').select('id, name').order('name'),
      ]);
      setWarehouses(whData || []);
      setTransfers(trData || []);
      setOpnames(opData || []);
      setInventory(invData || []);
      setProjects(projRes.data || []);
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memuat data Multi-Gudang.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [projectId]);

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createWarehouse({
        project_id: whType === 'CENTRAL' ? null : projectId,
        code: whCode.trim(),
        name: whName.trim(),
        warehouse_type: whType,
        location: whLocation,
        pic_name: whPic,
      });
      emitToast('success', 'Gudang baru berhasil ditambahkan.');
      setWhModal(false);
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal membuat gudang.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const invItem = inventory.find((i) => i.hsd_id === trHsdId);
    if (!trTargetProjectId || !trHsdId || Number(trQty) <= 0) {
      return emitToast('error', 'Lengkapi proyek tujuan, material, dan kuantitas transfer.');
    }
    setBusy(true);
    try {
      await createMaterialTransfer({
        transfer_number: trNumber.trim(),
        source_project_id: trSourceType === 'CENTRAL' ? null : projectId,
        target_project_id: trTargetProjectId,
        hsd_id: trHsdId,
        quantity: Number(trQty),
        unit_cost: Number(invItem?.master_hsd?.harga_dasar || 0),
        notes: trNotes,
      });
      emitToast('success', `Material Transfer Request ${trNumber} dibuat.`);
      setTrModal(false);
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal membuat Material Transfer.');
    } finally {
      setBusy(false);
    }
  };

  const handleExecuteTransfer = async (transferId: string) => {
    setBusy(true);
    try {
      await executeMaterialTransfer(transferId, projectId);
      emitToast('success', 'Transfer material berhasil dieksekusi & beban biaya antar-proyek otomatis dipindahkan!');
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal mengeksekusi transfer.');
    } finally {
      setBusy(false);
    }
  };

  const openOpnameModal = () => {
    setOpNumber(`OPN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setOpDate(new Date().toISOString().split('T')[0]);
    setOpNotes('');
    const activeStock = inventory.filter((i) => Number(i.stok_on_hand || 0) > 0 || i.id);
    setOpLines(
      activeStock.slice(0, 25).map((i) => ({
        inventory_id: i.id || null,
        hsd_id: i.hsd_id,
        item_name: i.master_hsd?.nama_item || 'Material',
        unit: i.master_hsd?.satuan || 'Unit',
        system_qty: Number(i.stok_on_hand || 0),
        physical_qty: Number(i.stok_on_hand || 0),
        unit_cost: Number(i.master_hsd?.harga_dasar || 0),
      }))
    );
    setOpModal(true);
  };

  const handleSaveOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (opLines.length === 0) return emitToast('error', 'Tidak ada item stok untuk opname.');
    setBusy(true);
    try {
      const summary = calculateStockOpnameVariance(
        opLines.map((l) => ({
          itemName: l.item_name,
          systemQty: l.system_qty,
          physicalQty: l.physical_qty,
          unitCost: l.unit_cost,
        }))
      );
      await createStockOpname(
        {
          project_id: projectId,
          opname_number: opNumber.trim(),
          opname_date: opDate,
          notes: opNotes,
          total_variance_value: summary.totalVarianceValue,
        },
        opLines.map((l, idx) => ({
          inventory_id: l.inventory_id,
          hsd_id: l.hsd_id,
          item_name: l.item_name,
          unit: l.unit,
          system_qty: l.system_qty,
          physical_qty: l.physical_qty,
          variance_qty: summary.lines[idx].varianceQty,
          unit_cost: l.unit_cost,
          variance_value: summary.lines[idx].varianceValue,
        }))
      );
      emitToast('success', `Dokumen Stock Opname ${opNumber} berhasil disimpan.`);
      setOpModal(false);
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menyimpan Stock Opname.');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveOpname = async (opnameId: string) => {
    setBusy(true);
    try {
      await approveStockOpname(opnameId, projectId);
      emitToast('success', 'Stock Opname disetujui & stok gudang telah disesuaikan ke hasil fisik!');
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menyetujui Stock Opname.');
    } finally {
      setBusy(false);
    }
  };

  const formatRp = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubTab('warehouses')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              subTab === 'warehouses' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Warehouse className="w-4 h-4" /> Gudang Pusat vs Site ({warehouses.length})
          </button>
          <button
            onClick={() => setSubTab('transfers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              subTab === 'transfers' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" /> Material Transfer Request ({transfers.length})
          </button>
          <button
            onClick={() => setSubTab('opname')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              subTab === 'opname' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" /> Stock Opname Berkala ({opnames.length})
          </button>
        </div>

        <div>
          {subTab === 'warehouses' && (
            <button
              onClick={() => {
                setWhCode(`WH-SITE-${Math.floor(10 + Math.random() * 90)}`);
                setWhName('');
                setWhType('SITE');
                setWhLocation('');
                setWhPic('');
                setWhModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Tambah Gudang
            </button>
          )}
          {subTab === 'transfers' && (
            <button
              onClick={() => {
                setTrNumber(`MTR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
                setTrSourceType('SITE');
                setTrTargetProjectId('');
                setTrHsdId('');
                setTrQty('');
                setTrNotes('');
                setTrModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Buat Transfer Material
            </button>
          )}
          {subTab === 'opname' && (
            <button
              onClick={openOpnameModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Buat Stock Opname
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-10 rounded-xl border text-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Memuat data gudang...
        </div>
      ) : subTab === 'warehouses' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((w) => (
            <div key={w.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-500">{w.code}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    w.warehouse_type === 'CENTRAL'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {w.warehouse_type === 'CENTRAL' ? 'Gudang Pusat' : 'Gudang Site'}
                </span>
              </div>
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" /> {w.name}
              </h4>
              <p className="text-xs text-slate-500">Lokasi: {w.location || '-'}</p>
              <p className="text-xs text-slate-500">PIC: <b>{w.pic_name || '-'}</b></p>
            </div>
          ))}
        </div>
      ) : subTab === 'transfers' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
              <tr>
                <th className="p-4 font-bold">No. MTR &amp; Tanggal</th>
                <th className="p-4 font-bold">Material</th>
                <th className="p-4 font-bold text-right">Qty</th>
                <th className="p-4 font-bold text-right">Realokasi Biaya</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transfers.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Belum ada dokumen Material Transfer Request.</td></tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-mono font-bold text-slate-800">{t.transfer_number}</div>
                      <div className="text-xs text-slate-400">{t.transfer_date}</div>
                    </td>
                    <td className="p-4 text-xs font-semibold">
                      {t.material?.nama_item || t.hsd_id}
                      <div className="text-[11px] text-slate-500">{t.notes || '-'}</div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold">{t.quantity} {t.material?.satuan || ''}</td>
                    <td className="p-4 text-right font-mono font-bold text-indigo-700">{formatRp(t.total_cost)}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        t.status === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {t.status !== 'Received' && canApprove && (
                        <button
                          onClick={() => handleExecuteTransfer(t.id)}
                          disabled={busy}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Terima &amp; Pindahkan Biaya
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
              <tr>
                <th className="p-4 font-bold">No. Opname &amp; Tanggal</th>
                <th className="p-4 font-bold">Jumlah Item</th>
                <th className="p-4 font-bold text-right">Total Selisih Nilai</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {opnames.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Belum ada dokumen Stock Opname.</td></tr>
              ) : (
                opnames.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-mono font-bold text-slate-800">{op.opname_number}</div>
                      <div className="text-xs text-slate-400">{op.opname_date}</div>
                    </td>
                    <td className="p-4 text-xs font-semibold">{(op.items || []).length} material</td>
                    <td className={`p-4 text-right font-mono font-bold ${Number(op.total_variance_value) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatRp(op.total_variance_value)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        op.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {op.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {op.status !== 'Approved' && canApprove && (
                        <button
                          onClick={() => handleApproveOpname(op.id)}
                          disabled={busy}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Setujui &amp; Sesuaikan Stok
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tambah Gudang */}
      {whModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateWarehouse} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Tambah Lokasi Gudang</h3>
              <button type="button" onClick={() => setWhModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kode Gudang *</label>
                <input required value={whCode} onChange={(e) => setWhCode(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Gudang</label>
                <select value={whType} onChange={(e) => setWhType(e.target.value as any)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="SITE">Gudang Site (Proyek)</option>
                  <option value="CENTRAL">Gudang Pusat (Central)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nama Gudang *</label>
              <input required value={whName} onChange={(e) => setWhName(e.target.value)} placeholder="cth: Gudang Site D.I. Saddang" className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Lokasi</label>
                <input value={whLocation} onChange={(e) => setWhLocation(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">PIC Gudang</label>
                <input value={whPic} onChange={(e) => setWhPic(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setWhModal(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={busy} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Simpan</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Transfer Material */}
      {trModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateTransfer} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Buat Material Transfer Request</h3>
              <button type="button" onClick={() => setTrModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">No. MTR *</label>
                <input required value={trNumber} onChange={(e) => setTrNumber(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Asal Stok</label>
                <select value={trSourceType} onChange={(e) => setTrSourceType(e.target.value as any)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="SITE">Site Proyek Aktif</option>
                  <option value="CENTRAL">Gudang Pusat (Central)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Proyek Tujuan *</label>
              <select required value={trTargetProjectId} onChange={(e) => setTrTargetProjectId(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                <option value="">-- Pilih Proyek Tujuan --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Material *</label>
                <select required value={trHsdId} onChange={(e) => setTrHsdId(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="">-- Pilih Material --</option>
                  {inventory.map((i) => (
                    <option key={i.hsd_id} value={i.hsd_id}>
                      {i.master_hsd?.nama_item} (Stok: {i.stok_on_hand} {i.master_hsd?.satuan})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Qty *</label>
                <input required type="number" min={0.01} step="any" value={trQty} onChange={(e) => setTrQty(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Catatan</label>
              <input value={trNotes} onChange={(e) => setTrNotes(e.target.value)} placeholder="cth: Sisa besi D13 dipindahkan ke proyek B" className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTrModal(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={busy} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Ajukan Transfer</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Stock Opname */}
      {opModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveOpname} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Buat Dokumen Stock Opname</h3>
              <button type="button" onClick={() => setOpModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. Opname *</label>
                  <input required value={opNumber} onChange={(e) => setOpNumber(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Opname</label>
                  <input type="date" value={opDate} onChange={(e) => setOpDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Catatan</label>
                  <input value={opNotes} onChange={(e) => setOpNotes(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 uppercase border-b">
                    <tr>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5 text-center">Stok Sistem</th>
                      <th className="p-2.5 text-center">Stok Fisik</th>
                      <th className="p-2.5 text-right">Selisih (Qty)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {opLines.map((l, idx) => {
                      const diff = Number(l.physical_qty) - Number(l.system_qty);
                      return (
                        <tr key={l.hsd_id || idx}>
                          <td className="p-2.5 font-bold">{l.item_name} <span className="text-slate-400">({l.unit})</span></td>
                          <td className="p-2.5 text-center font-mono">{l.system_qty}</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={l.physical_qty}
                              onChange={(e) => {
                                const next = [...opLines];
                                next[idx].physical_qty = Number(e.target.value);
                                setOpLines(next);
                              }}
                              className="w-24 border rounded p-1 text-center font-mono font-bold"
                            />
                          </td>
                          <td className={`p-2.5 text-right font-mono font-bold ${diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-2">
              <button type="button" onClick={() => setOpModal(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={busy} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Simpan Opname</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
