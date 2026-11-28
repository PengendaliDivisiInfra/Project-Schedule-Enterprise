'use client';

import { useEffect, useState } from 'react';
import {
  QrCode,
  ArrowLeftRight,
  CheckCircle2,
  Printer,
  Truck,
  UserCheck,
  Loader2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/hooks/useRole';
import {
  listProjectAssetUnits,
  updateUnitAssetTagAndCustodian,
  listAssetCustodyTransfers,
  createAssetCustodyTransfer,
  acceptAssetCustodyTransfer,
} from '@/lib/services/asset-custody.service';
import { buildAssetQrPayload } from '@/lib/utils/vendor-equipment-controls';
import { generateQrSvg } from '@/lib/utils/qr-svg';
import { resolveProjectBranding, escapePrintHtml } from '@/lib/utils/print-branding';

export default function EquipmentCustodyPage({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  const { can } = useRole(projectId);
  const canManage = can('EDIT_PO') || can('APPROVE_PROCUREMENT');

  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectInfo, setActiveProjectInfo] = useState<any | null>(null);

  // QR Modal
  const [qrUnit, setQrUnit] = useState<any | null>(null);

  // Transfer Modal
  const [transferUnit, setTransferUnit] = useState<any | null>(null);
  const [toProjectId, setToProjectId] = useState('');
  const [toCustodianName, setToCustodianName] = useState('');
  const [conditionAtHandover, setConditionAtHandover] = useState('GOOD');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const emitToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message } }));
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [uData, tData, pRes, activeProjRes] = await Promise.all([
        listProjectAssetUnits(projectId),
        listAssetCustodyTransfers(projectId),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('projects').select('id, name, company_name, contractor_name, contractor_address, logo_url').eq('id', projectId).maybeSingle(),
      ]);
      setUnits(uData || []);
      setTransfers(tData || []);
      setProjects(pRes.data || []);
      setActiveProjectInfo(activeProjRes.data || null);
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memuat data custody aset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [projectId]);

  const handleMarkCompanyOwned = async (unit: any) => {
    try {
      const nextType = unit.ownership_type === 'COMPANY_OWNED' ? 'RENTED' : 'COMPANY_OWNED';
      const tag = unit.asset_tag || `AST-${String(unit.unit_code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;
      await updateUnitAssetTagAndCustodian(unit.id, projectId, {
        ownership_type: nextType,
        asset_tag: tag,
      });
      emitToast('success', `Status kepemilikan ${unit.unit_code} diperbarui menjadi ${nextType}.`);
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memperbarui status aset.');
    }
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferUnit || !toProjectId || !toCustodianName.trim()) {
      return emitToast('error', 'Pilih proyek tujuan dan isi nama PM/Penanggung Jawab penerima.');
    }
    setBusy(true);
    try {
      const tag = transferUnit.asset_tag || `AST-${transferUnit.unit_code}`;
      const trNo = `BAST-AST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await createAssetCustodyTransfer({
        transfer_number: trNo,
        unit_id: transferUnit.id,
        asset_tag: tag,
        from_project_id: projectId,
        to_project_id: toProjectId,
        from_custodian_name: transferUnit.custodian_name || 'PM Proyek Asal',
        to_custodian_name: toCustodianName.trim(),
        condition_at_handover: conditionAtHandover,
        handover_notes: handoverNotes,
      });
      emitToast('success', `Berita Acara Serah Terima Aset ${trNo} diajukan!`);
      setTransferUnit(null);
      setToProjectId('');
      setToCustodianName('');
      setHandoverNotes('');
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal mengajukan serah terima aset.');
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptTransfer = async (transferId: string) => {
    setBusy(true);
    try {
      await acceptAssetCustodyTransfer(transferId, projectId);
      emitToast('success', 'Serah terima aset diterima! Custody & proyek pemilik unit resmi diperbarui.');
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menerima serah terima aset.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrintQrTag = () => {
    if (!qrUnit) return;
    const tag = qrUnit.asset_tag || `AST-${qrUnit.unit_code}`;
    const payload = buildAssetQrPayload({ assetTag: tag, unitId: qrUnit.id, projectId });
    const svg = generateQrSvg(payload, 200);
    const branding = resolveProjectBranding(activeProjectInfo);
    const win = window.open('', '_blank', 'width=440,height=560');
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html>
        <head><title>QR Asset Tag - ${escapePrintHtml(tag)}</title></head>
        <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:24px;">
          <div style="border:2px solid #0f172a;border-radius:14px;padding:20px;display:inline-block;max-width:340px;">
            ${branding.logoUrl ? `<img src="${escapePrintHtml(branding.logoUrl)}" alt="Logo" style="max-height:38px;max-width:120px;object-fit:contain;margin-bottom:6px;" />` : ''}
            <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;color:#312e81;text-transform:uppercase;">${escapePrintHtml(branding.companyName)}</div>
            <div style="font-size:9px;color:#64748b;margin-top:2px;">${escapePrintHtml(branding.companyAddress)}</div>
            <div style="border-top:1px solid #cbd5e1;margin:8px 0;"></div>
            <h2 style="margin:4px 0;">${escapePrintHtml(tag)}</h2>
            <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:#1e293b;">${escapePrintHtml(qrUnit.unit_code)} &bull; ${escapePrintHtml(qrUnit.equipment_categories?.name || 'Aset Proyek')}</div>
            ${svg}
            <div style="font-size:11px;margin-top:8px;color:#334155;">Custodian: <b>${escapePrintHtml(qrUnit.custodian_name || 'Site PM')}</b></div>
            <div style="font-size:9px;margin-top:4px;color:#64748b;font-family:monospace;">${escapePrintHtml(payload)}</div>
          </div>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <QrCode className="text-indigo-600" /> Serah Terima Aset Antar-PM (Custody Transfer &amp; QR Tag)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Lacak penanggung jawab (Custodian PM) setiap unit alat perusahaan dengan label <b>QR Code Asset Tag</b> dan Berita Acara Serah Terima antar-proyek.
          </p>
        </div>
      </div>

      {/* Daftar Unit Aset di Proyek Ini */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <div className="p-4 border-b bg-slate-50/70">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600" /> Daftar Aset &amp; Unit di Proyek Aktif ({units.length})
          </h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
            <tr>
              <th className="p-4 font-bold">QR Asset Tag &amp; Unit</th>
              <th className="p-4 font-bold">Kategori</th>
              <th className="p-4 font-bold text-center">Kepemilikan</th>
              <th className="p-4 font-bold">Custodian PM Aktif</th>
              <th className="p-4 font-bold text-center">Kondisi</th>
              <th className="p-4 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Memuat daftar aset...</td></tr>
            ) : units.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Belum ada unit alat terdaftar di proyek ini.</td></tr>
            ) : (
              units.map((u) => {
                const tag = u.asset_tag || `AST-${u.unit_code}`;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-mono font-bold text-indigo-700">{tag}</div>
                      <div className="text-xs font-semibold text-slate-700">Unit: {u.unit_code}</div>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-700">{u.equipment_categories?.name || '-'}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => canManage && handleMarkCompanyOwned(u)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.ownership_type === 'COMPANY_OWNED'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                        title="Klik untuk ubah status Milik Perusahaan / Sewa"
                      >
                        {u.ownership_type === 'COMPANY_OWNED' ? 'Milik Perusahaan' : 'Alat Sewa'}
                      </button>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> {u.custodian_name || 'PM Proyek Aktif'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase border border-emerald-200">
                        {u.condition_status || 'GOOD'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setQrUnit(u)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                        >
                          <QrCode className="w-3.5 h-3.5" /> QR Tag
                        </button>
                        {canManage && (
                          <button
                            onClick={() => {
                              setTransferUnit(u);
                              setToProjectId('');
                              setToCustodianName('');
                              setConditionAtHandover(u.condition_status || 'GOOD');
                              setHandoverNotes('');
                            }}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" /> Serah Terima
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Riwayat Berita Acara Serah Terima Aset */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <div className="p-4 border-b bg-slate-50/70">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-emerald-600" /> Riwayat Serah Terima Aset Antar-PM ({transfers.length})
          </h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
            <tr>
              <th className="p-4 font-bold">No. BAST &amp; Tanggal</th>
              <th className="p-4 font-bold">Asset Tag</th>
              <th className="p-4 font-bold">Dari → Ke Proyek</th>
              <th className="p-4 font-bold">Penerima (Custodian PM)</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transfers.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Belum ada riwayat serah terima aset.</td></tr>
            ) : (
              transfers.map((tr) => (
                <tr key={tr.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-mono font-bold text-slate-800">{tr.transfer_number}</div>
                    <div className="text-xs text-slate-400">{tr.transfer_date}</div>
                  </td>
                  <td className="p-4 font-mono text-xs font-bold text-indigo-700">{tr.asset_tag}</td>
                  <td className="p-4 text-xs">
                    <span className="text-slate-500">{tr.from_project?.name || 'Asal'}</span> →{' '}
                    <b className="text-slate-800">{tr.to_project?.name || 'Tujuan'}</b>
                  </td>
                  <td className="p-4 text-xs font-semibold text-slate-700">{tr.to_custodian_name}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      tr.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {tr.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {tr.status === 'Pending' && tr.to_project_id === projectId && canManage ? (
                      <button
                        onClick={() => handleAcceptTransfer(tr.id)}
                        disabled={busy}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Terima Aset
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tampil & Cetak QR Code Asset Tag */}
      {qrUnit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" /> Stiker QR Asset Tag
              </h3>
              <button onClick={() => setQrUnit(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            {(() => {
              const tag = qrUnit.asset_tag || `AST-${qrUnit.unit_code}`;
              const payload = buildAssetQrPayload({ assetTag: tag, unitId: qrUnit.id, projectId });
              const svgMarkup = generateQrSvg(payload, 200);
              return (
                <div className="space-y-2">
                  <p className="font-mono font-extrabold text-lg text-indigo-700">{tag}</p>
                  <p className="text-xs text-slate-600 font-semibold">
                    {qrUnit.unit_code} • {qrUnit.equipment_categories?.name || 'Unit Aset'}
                  </p>
                  <div
                    className="mx-auto inline-block p-3 bg-white border-2 border-slate-200 rounded-xl shadow-sm"
                    dangerouslySetInnerHTML={{ __html: svgMarkup }}
                  />
                  <p className="text-[10px] font-mono text-slate-400 break-all">{payload}</p>
                </div>
              );
            })()}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setQrUnit(null)} className="flex-1 py-2 border rounded-xl text-xs font-bold text-slate-600">Tutup</button>
              <button onClick={handlePrintQrTag} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                <Printer className="w-4 h-4" /> Cetak Stiker QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Serah Terima Aset */}
      {transferUnit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmitTransfer} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">
                Serah Terima Aset: {transferUnit.asset_tag || transferUnit.unit_code}
              </h3>
              <button type="button" onClick={() => setTransferUnit(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Proyek Tujuan *</label>
              <select required value={toProjectId} onChange={(e) => setToProjectId(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                <option value="">-- Pilih Proyek Tujuan --</option>
                {projects.filter((p) => p.id !== projectId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nama PM / Penanggung Jawab Penerima *</label>
              <input required value={toCustodianName} onChange={(e) => setToCustodianName(e.target.value)} placeholder="cth: Mei Sunarko (PM Site B)" className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Kondisi Fisik Saat Serah Terima</label>
              <select value={conditionAtHandover} onChange={(e) => setConditionAtHandover(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                <option value="GOOD">Baik / Siap Operasi (GOOD)</option>
                <option value="MINOR_DAMAGE">Rusak Ringan (MINOR_DAMAGE)</option>
                <option value="MAINTENANCE">Perlu Perawatan (MAINTENANCE)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Kelengkapan / HM Terakhir</label>
              <textarea rows={2} value={handoverNotes} onChange={(e) => setHandoverNotes(e.target.value)} placeholder="cth: Kunci kontak 2 pcs, HM 1540, tangki BBM 50%" className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setTransferUnit(null)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={busy} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {busy ? 'Menyimpan...' : 'Ajukan Serah Terima'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
