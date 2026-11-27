'use client';

import { useEffect, useState } from 'react';
import {
  FileDiff,
  Lock,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileSignature,
  UploadCloud,
  History,
  Loader2,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import {
  listRabVersions,
  lockRabBaseline,
  listContractChangeOrders,
  createContractChangeOrder,
  updateCcoStatus,
  signCcoAndCreateRabVersion,
  listUnapprovedVariationWork,
} from '@/lib/services/contractor-controls.service';
import { getWbsBudget3Layer, type WbsBudget3LayerRow } from '@/lib/services/budget-control.service';
import { uploadPrivateFile } from '@/lib/utils/secure-storage';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function ChangeOrdersPage() {
  const { activeProjectId } = useProject();
  const { can } = useRole(activeProjectId || undefined);
  const canApprove = can('APPROVE_FINANCE') || can('APPROVE_PROCUREMENT');

  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<any[]>([]);
  const [ccos, setCcos] = useState<any[]>([]);
  const [unapprovedWork, setUnapprovedWork] = useState<any[]>([]);
  const [wbsList, setWbsList] = useState<WbsBudget3LayerRow[]>([]);

  const [lockingBaseline, setLockingBaseline] = useState(false);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);

  // Create CCO Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ccoNumber, setCcoNumber] = useState('');
  const [title, setTitle] = useState('');
  const [ccoType, setCcoType] = useState<'ADDITION' | 'DEDUCTION' | 'MIXED'>('ADDITION');
  const [wbsCode, setWbsCode] = useState('');
  const [deltaAmount, setDeltaAmount] = useState('');
  const [description, setDescription] = useState('');

  // Sign CCO Modal
  const [signTarget, setSignTarget] = useState<any | null>(null);
  const [signedDate, setSignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [signing, setSigning] = useState(false);

  const emitToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message } }));
    }
  };

  const loadAll = async () => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [verData, ccoData, unappData, wbsData] = await Promise.all([
        listRabVersions(activeProjectId),
        listContractChangeOrders(activeProjectId),
        listUnapprovedVariationWork(activeProjectId),
        getWbsBudget3Layer(activeProjectId).catch(() => []),
      ]);
      setVersions(verData || []);
      setCcos(ccoData || []);
      setUnapprovedWork(unappData || []);
      setWbsList(wbsData || []);
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memuat data Addendum & Versi RAB.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [activeProjectId]);

  const hasBaselineV0 = versions.some((v) => Number(v.version_no) === 0);
  const latestVersion = versions[0] || null;
  const totalUnapprovedCost = unapprovedWork.reduce((s, r) => s + Number(r.incurred_cost || 0), 0);

  const handleLockBaseline = async () => {
    if (!activeProjectId) return;
    setLockingBaseline(true);
    try {
      await lockRabBaseline(activeProjectId, 'Penguncian RAB Baseline Kontrak (Versi 0)');
      emitToast('success', 'RAB Baseline (Versi 0) berhasil dikunci secara permanen!');
      setConfirmLockOpen(false);
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal mengunci RAB Baseline.');
    } finally {
      setLockingBaseline(false);
    }
  };

  const handleCreateCco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId || !ccoNumber.trim() || !title.trim()) {
      return emitToast('error', 'Nomor CCO dan Judul Addendum wajib diisi.');
    }
    setSaving(true);
    try {
      await createContractChangeOrder({
        project_id: activeProjectId,
        cco_number: ccoNumber.trim(),
        title: title.trim(),
        description,
        cco_type: ccoType,
        wbs_code: wbsCode || null,
        delta_amount: Number(deltaAmount || 0),
        base_version_no: latestVersion ? Number(latestVersion.version_no) : 0,
      });
      emitToast('success', `Draft CCO ${ccoNumber} berhasil dibuat.`);
      setCreateOpen(false);
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal membuat CCO.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignCco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signTarget || !activeProjectId) return;
    setSigning(true);
    try {
      let docPath: string | null = null;
      if (signedFile) {
        const ext = signedFile.name.split('.').pop() || 'pdf';
        docPath = await uploadPrivateFile(
          'evidence',
          `${activeProjectId}/cco_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`,
          signedFile
        );
      }

      const res: any = await signCcoAndCreateRabVersion({
        ccoId: signTarget.id,
        projectId: activeProjectId,
        signedDate,
        signedDocUrl: docPath,
      });

      emitToast(
        'success',
        `CCO ${signTarget.cco_number} ditandatangani! Terbentuk Revisi RAB Versi ${res?.version_no ?? ''} (Histori v0 tetap utuh).`
      );
      setSignTarget(null);
      setSignedFile(null);
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menandatangani CCO.');
    } finally {
      setSigning(false);
    }
  };

  const formatRp = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  if (!activeProjectId) {
    return <div className="p-10 text-center text-slate-500">Pilih proyek terlebih dahulu.</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileDiff className="text-indigo-600" /> Addendum / CCO &amp; Versi RAB Terkunci
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Kunci <b>RAB Baseline (Versi 0)</b>, kelola <b>Contract Change Order (CCO)</b> menjadi Versi 1, 2, dst., serta pantau <b>Pekerjaan Tambah Tanpa Addendum</b>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasBaselineV0 && canApprove && (
              <button
                onClick={() => setConfirmLockOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-4 h-4" /> Kunci RAB Baseline (v0)
              </button>
            )}
            <button
              onClick={() => {
                setCcoNumber(`CCO-${new Date().getFullYear()}-${String(ccos.length + 1).padStart(3, '0')}`);
                setTitle('');
                setCcoType('ADDITION');
                setWbsCode('');
                setDeltaAmount('');
                setDescription('');
                setCreateOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Ajukan CCO / Addendum
            </button>
          </div>
        </div>

        {/* UNAPPROVED WORK ALERT BANNER */}
        {unapprovedWork.length > 0 && (
          <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={22} />
              <div className="flex-1">
                <h2 className="font-bold text-rose-800 text-sm">
                  UNAPPROVED WORK ALERT: {unapprovedWork.length} Pengeluaran Pekerjaan Tambah Belum Memiliki Addendum Resmi!
                </h2>
                <p className="text-xs text-rose-700 mt-0.5">
                  Total eksposur biaya lapangan tanpa CCO bertandatangan: <b className="font-mono">{formatRp(totalUnapprovedCost)}</b>. Segera lengkapi &amp; tandatangani Addendum klien agar biaya dapat ditagih.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto bg-white rounded-xl border border-rose-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-rose-100/60 text-rose-800 uppercase">
                  <tr>
                    <th className="p-2.5">Sumber</th>
                    <th className="p-2.5">WBS</th>
                    <th className="p-2.5">Uraian Pekerjaan Tambah</th>
                    <th className="p-2.5">Status CCO</th>
                    <th className="p-2.5 text-right">Biaya Sudah Keluar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100">
                  {unapprovedWork.map((item, idx) => (
                    <tr key={`${item.record_id}-${idx}`}>
                      <td className="p-2.5 font-mono font-bold text-slate-600">{item.source_type}</td>
                      <td className="p-2.5 font-mono">{item.wbs_code || '-'}</td>
                      <td className="p-2.5 font-semibold text-slate-800">{item.work_label}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold uppercase text-[10px]">
                          {item.cco_number ? `${item.cco_number} (${item.cco_status})` : 'TANPA CCO'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-700">{formatRp(item.incurred_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HISTORI VERSI RAB TERKUNCI */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 text-base">
              <History className="w-5 h-5 text-indigo-600" /> Histori Versi RAB Terkunci (Baseline v0 → Revised v1, v2...)
            </h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {hasBaselineV0 ? `Versi Aktif: v${latestVersion?.version_no ?? 0}` : 'Baseline v0 Belum Dikunci'}
            </span>
          </div>

          {versions.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400 italic bg-slate-50 rounded-xl border border-dashed">
              Belum ada versi RAB terkunci. Klik <b>Kunci RAB Baseline (v0)</b> untuk mengunci nilai kontrak awal sebelum perubahan.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {versions.map((v) => (
                <div key={v.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-xs font-bold">
                      v{v.version_no}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" /> LOCKED
                    </span>
                  </div>
                  <p className="font-bold text-sm text-slate-800">{v.version_label}</p>
                  <p className="font-mono font-extrabold text-lg text-indigo-700">{formatRp(v.total_rab)}</p>
                  <p className="text-[11px] text-slate-500">
                    {v.task_count} item WBS • Dikunci {new Date(v.locked_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DAFTAR CONTRACT CHANGE ORDERS (CCO / ADDENDUM) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b bg-slate-50/70">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-indigo-600" /> Daftar Contract Change Order (CCO / Variation Order)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase border-b">
                <tr>
                  <th className="p-4 font-bold">No. CCO &amp; Judul</th>
                  <th className="p-4 font-bold">Tipe / WBS</th>
                  <th className="p-4 font-bold text-right">Nilai Tambah / Kurang</th>
                  <th className="p-4 font-bold text-center">Versi RAB</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ccos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400 italic">
                      Belum ada pengajuan CCO / Addendum.
                    </td>
                  </tr>
                ) : (
                  ccos.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-mono font-bold text-indigo-700">{c.cco_number}</div>
                        <div className="font-bold text-slate-800">{c.title}</div>
                        {c.description && <div className="text-xs text-slate-500 mt-0.5">{c.description}</div>}
                      </td>
                      <td className="p-4 text-xs">
                        <span className="font-bold uppercase text-slate-700">{c.cco_type}</span>
                        <div className="font-mono text-slate-500">WBS: {c.wbs_code || 'Umum'}</div>
                      </td>
                      <td className={`p-4 text-right font-mono font-bold ${Number(c.delta_amount) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {Number(c.delta_amount) >= 0 ? '+' : ''}{formatRp(c.delta_amount)}
                      </td>
                      <td className="p-4 text-center font-mono text-xs">
                        {c.resulting_version_no !== null && c.resulting_version_no !== undefined
                          ? `v${c.base_version_no} → v${c.resulting_version_no}`
                          : `Base v${c.base_version_no}`}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            c.status === 'Signed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : c.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {c.status === 'Draft' && (
                            <button
                              onClick={async () => {
                                await updateCcoStatus(c.id, activeProjectId, 'Submitted');
                                emitToast('info', `CCO ${c.cco_number} diajukan untuk persetujuan.`);
                                loadAll();
                              }}
                              className="px-2.5 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-bold"
                            >
                              Ajukan
                            </button>
                          )}
                          {(c.status === 'Draft' || c.status === 'Submitted' || c.status === 'Approved') && canApprove && (
                            <button
                              onClick={() => {
                                setSignTarget(c);
                                setSignedDate(new Date().toISOString().split('T')[0]);
                                setSignedFile(null);
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Tandatangani &amp; Revisi RAB
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
        </div>
      </div>

      {/* Modal Ajukan CCO */}
      {createOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateCco} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">Ajukan Contract Change Order (CCO)</h3>
              <button type="button" onClick={() => setCreateOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">No. CCO / Addendum *</label>
                <input required value={ccoNumber} onChange={(e) => setCcoNumber(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Perubahan</label>
                <select value={ccoType} onChange={(e) => setCcoType(e.target.value as any)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="ADDITION">Pekerjaan Tambah (+)</option>
                  <option value="DEDUCTION">Pekerjaan Kurang (-)</option>
                  <option value="MIXED">Tambah &amp; Kurang (Net)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Judul Perubahan Kontrak *</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="cth: Tambahan Borepile Zona B akibat Kondisi Tanah" className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Target Pos WBS (Opsional)</label>
                <select value={wbsCode} onChange={(e) => setWbsCode(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="">-- Umum / Seluruh Kontrak --</option>
                  {wbsList.map((w) => (
                    <option key={w.wbs_code} value={w.wbs_code}>[{w.wbs_code}] {w.task_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nilai Delta Perubahan (Rp) *</label>
                <input required type="number" value={deltaAmount} onChange={(e) => setDeltaAmount(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Justifikasi Teknis</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                {saving ? 'Menyimpan...' : 'Simpan Draft CCO'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Tandatangani CCO -> Bentuk Versi RAB Baru */}
      {signTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSignCco} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <FileSignature className="text-emerald-600" /> Tandatangani {signTarget.cco_number}
            </h3>
            <p className="text-xs text-slate-600">
              Menandatangani CCO ini akan otomatis membentuk <b>Revisi RAB Versi Baru</b> dengan delta <b>{formatRp(signTarget.delta_amount)}</b> dan memperbarui nilai kontrak tanpa menghapus histori Baseline v0.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Tanda Tangan Addendum</label>
              <input required type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Scan Dokumen Addendum Bertandatangan (Opsional)</label>
              <label className="cursor-pointer border rounded-lg px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span className="truncate">{signedFile ? signedFile.name : 'Unggah PDF / Scan Addendum'}</span>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setSignedFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setSignTarget(null)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={signing} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {signing ? 'Memproses...' : 'Konfirmasi & Terbitkan Revisi RAB'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmLockOpen}
        title="Kunci RAB Baseline (Versi 0)?"
        message="Snapshot seluruh item WBS saat ini akan dikunci permanen sebagai RAB Baseline Versi 0. Perubahan nilai kontrak selanjutnya wajib melalui alur CCO / Addendum."
        isLoading={lockingBaseline}
        onConfirm={handleLockBaseline}
        onClose={() => setConfirmLockOpen(false)}
      />
    </div>
  );
}
