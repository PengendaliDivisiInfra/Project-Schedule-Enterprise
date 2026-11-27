'use client';

import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  UploadCloud,
  ExternalLink,
  CheckCircle2,
  Ban,
  Loader2,
  X,
  HardHat,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  listHseWorkPermits,
  createHseWorkPermit,
  updateHseWorkPermitStatus,
  toggleWbsHighRisk,
} from '@/lib/services/hse-workforce.service';
import { uploadPrivateFile, getSignedFileUrl, SIGNED_URL_EXPIRY_SECONDS } from '@/lib/utils/secure-storage';
import { compressFieldPhoto } from '@/lib/utils/image-compressor';

interface Props {
  projectId: string;
  showToast: (type: 'success' | 'danger', message: string) => void;
}

export function HsePermitGateManager({ projectId, showToast }: Props) {
  const [loading, setLoading] = useState(true);
  const [permits, setPermits] = useState<any[]>([]);
  const [wbsTasks, setWbsTasks] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permitType, setPermitType] = useState<'JSA' | 'WORK_PERMIT' | 'ZERO_ACCIDENT'>('JSA');
  const [permitNumber, setPermitNumber] = useState('');
  const [wbsCode, setWbsCode] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [riskLevel, setRiskLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [picName, setPicName] = useState('');
  const [hseOfficer, setHseOfficer] = useState('');
  const [notes, setNotes] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const loadAll = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [permData, wbsRes] = await Promise.all([
        listHseWorkPermits(projectId),
        supabase
          .from('wbs_tasks')
          .select('id, wbs_code, name, summary, is_high_risk, risk_category')
          .eq('project_id', projectId)
          .order('wbs_code'),
      ]);
      setPermits(permData || []);
      const leafTasks = (wbsRes.data || []).filter((t: any) => t.summary !== 'Yes');
      setWbsTasks(leafTasks);
    } catch (err: any) {
      showToast('danger', err?.message || 'Gagal memuat data HSE Compliance Gate.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [projectId]);

  const handleSavePermit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permitNumber.trim() || !workTitle.trim()) {
      return showToast('danger', 'Nomor dokumen dan judul pekerjaan wajib diisi.');
    }
    setSaving(true);
    try {
      let docPath: string | null = null;
      if (docFile) {
        const compressed = await compressFieldPhoto(docFile, { maxDimension: 1400, quality: 0.78 });
        const ext = compressed.file.name.split('.').pop() || 'jpg';
        docPath = await uploadPrivateFile(
          'evidence',
          `${projectId}/hse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`,
          compressed.file
        );
      }

      await createHseWorkPermit({
        project_id: projectId,
        wbs_code: wbsCode || null,
        permit_type: permitType,
        permit_number: permitNumber.trim(),
        work_title: workTitle.trim(),
        risk_level: riskLevel,
        valid_from: validFrom,
        valid_until: validUntil,
        pic_name: picName,
        hse_officer_name: hseOfficer,
        document_url: docPath,
        notes,
      });

      showToast('success', `${permitType} ${permitNumber} berhasil diterbitkan!`);
      setModalOpen(false);
      setDocFile(null);
      loadAll();
    } catch (err: any) {
      showToast('danger', err?.message || 'Gagal menyimpan izin kerja HSE.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHighRisk = async (task: any) => {
    try {
      const next = !Boolean(task.is_high_risk);
      await toggleWbsHighRisk(task.id, projectId, next, 'Ketinggian / Galian Dalam / Alat Berat');
      showToast(
        'success',
        next
          ? `WBS [${task.wbs_code}] dikunci dengan HSE Compliance Gate (Wajib JSA / Work Permit).`
          : `HSE High-Risk Gate untuk WBS [${task.wbs_code}] dinonaktifkan.`
      );
      loadAll();
    } catch (err: any) {
      showToast('danger', err?.message || 'Gagal mengubah status risiko WBS.');
    }
  };

  const handleOpenDoc = async (path: string) => {
    const url = await getSignedFileUrl('evidence', path, SIGNED_URL_EXPIRY_SECONDS);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else showToast('danger', 'Gagal membuka dokumen Signed URL.');
  };

  if (loading) {
    return (
      <div className="bg-white p-10 rounded-xl border text-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" /> Memuat HSE Compliance Gate...
      </div>
    );
  }

  const highRiskCount = wbsTasks.filter((t) => t.is_high_risk).length;
  const activePermitsCount = permits.filter((p) => p.status === 'Active').length;

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <HardHat className="text-amber-600" /> HSE Compliance Gate (JSA, Work Permit &amp; High-Risk WBS)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pekerjaan yang ditandai <b>Risiko Tinggi</b> otomatis diblokir pada halaman <b>Progres Harian</b> sampai dokumen <b>JSA / Work Permit</b> aktif terunggah.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
            {highRiskCount} WBS Risiko Tinggi
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            {activePermitsCount} Izin Kerja Aktif
          </span>
          <button
            onClick={() => {
              setPermitType('JSA');
              setPermitNumber(`JSA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
              setWbsCode('');
              setWorkTitle('');
              setPicName('');
              setHseOfficer('');
              setNotes('');
              setDocFile(null);
              setModalOpen(true);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Terbitkan JSA / Work Permit
          </button>
        </div>
      </div>

      {/* Tabel JSA & Work Permit */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="p-4 border-b bg-amber-50/40 font-bold text-sm text-amber-900">
          Daftar Dokumen JSA, Work Permit &amp; Zero-Accident Clearance
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
            <tr>
              <th className="p-3.5 font-bold">Tipe &amp; No. Dokumen</th>
              <th className="p-3.5 font-bold">WBS &amp; Lingkup Pekerjaan</th>
              <th className="p-3.5 font-bold text-center">Masa Berlaku</th>
              <th className="p-3.5 font-bold text-center">Status</th>
              <th className="p-3.5 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {permits.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                  Belum ada JSA atau Work Permit terdaftar.
                </td>
              </tr>
            ) : (
              permits.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase mr-2">
                      {p.permit_type}
                    </span>
                    <span className="font-mono font-bold text-slate-800">{p.permit_number}</span>
                  </td>
                  <td className="p-3.5 text-xs">
                    <div className="font-bold text-slate-800">{p.work_title}</div>
                    <div className="text-slate-500 font-mono">
                      WBS: {p.wbs_code || 'Seluruh Proyek'} • HSE: {p.hse_officer_name || '-'}
                    </div>
                  </td>
                  <td className="p-3.5 text-center font-mono text-xs text-slate-600">
                    {p.valid_from} s/d {p.valid_until}
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        p.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {p.document_url && (
                        <button
                          onClick={() => handleOpenDoc(p.document_url)}
                          className="text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> File
                        </button>
                      )}
                      {p.status === 'Active' && (
                        <button
                          onClick={async () => {
                            await updateHseWorkPermitStatus(p.id, projectId, 'Revoked');
                            showToast('success', `Izin kerja ${p.permit_number} dicabut (Revoked).`);
                            loadAll();
                          }}
                          className="text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded border border-rose-200 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" /> Cabut
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

      {/* Pengaturan WBS Risiko Tinggi */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="p-4 border-b bg-slate-50 font-bold text-sm text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600" /> Pengaturan Kunci HSE Gate pada Item WBS Berisiko Tinggi
        </div>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 border-b">
              <tr>
                <th className="p-3">WBS</th>
                <th className="p-3">Nama Pekerjaan</th>
                <th className="p-3 text-center">Status HSE Gate</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wbsTasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-700">{t.wbs_code}</td>
                  <td className="p-3 font-medium text-slate-800">{t.name}</td>
                  <td className="p-3 text-center">
                    {t.is_high_risk ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold inline-flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Wajib JSA / PTW
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">
                        Standar
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggleHighRisk(t)}
                      className={`px-3 py-1 rounded-lg font-bold border ${
                        t.is_high_risk
                          ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {t.is_high_risk ? 'Nonaktifkan Gate' : 'Tandai Risiko Tinggi'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Terbitkan JSA / Work Permit */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSavePermit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" /> Terbitkan Dokumen JSA / Work Permit
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jenis Dokumen *</label>
                <select value={permitType} onChange={(e) => setPermitType(e.target.value as any)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="JSA">JSA (Job Safety Analysis)</option>
                  <option value="WORK_PERMIT">Work Permit (Izin Kerja)</option>
                  <option value="ZERO_ACCIDENT">Laporan Zero-Accident Harian</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nomor Dokumen *</label>
                <input required value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Target WBS (Opsional)</label>
                <select value={wbsCode} onChange={(e) => setWbsCode(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="">-- Berlaku untuk Seluruh WBS Proyek --</option>
                  {wbsTasks.map((t) => (
                    <option key={t.id} value={t.wbs_code}>[{t.wbs_code}] {t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tingkat Risiko</label>
                <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as any)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="HIGH">HIGH (Tinggi)</option>
                  <option value="CRITICAL">CRITICAL (Kritis)</option>
                  <option value="MEDIUM">MEDIUM (Sedang)</option>
                  <option value="LOW">LOW (Rendah)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Judul Pekerjaan / Aktivitas *</label>
              <input required value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} placeholder="cth: Pengeboran Borepile & Lifting Casing" className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Berlaku Dari *</label>
                <input required type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Berlaku Sampai *</label>
                <input required type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">PIC Lapangan</label>
                <input value={picName} onChange={(e) => setPicName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">HSE Officer / Verifikator</label>
                <input value={hseOfficer} onChange={(e) => setHseOfficer(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Unggah Dokumen JSA / Work Permit (Kompresi Otomatis + Private)</label>
              <label className="cursor-pointer border rounded-lg px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span className="truncate">{docFile ? docFile.name : 'Pilih File Foto / PDF'}</span>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Simpan &amp; Aktifkan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
