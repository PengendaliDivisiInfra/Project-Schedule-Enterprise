'use client';

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  AlertTriangle,
  CalendarClock,
  Landmark,
  UploadCloud,
  CheckCircle2,
  Loader2,
  ExternalLink,
  X,
} from 'lucide-react';
import { useRole } from '@/lib/hooks/useRole';
import {
  listBankGuarantees,
  createBankGuarantee,
  updateBankGuaranteeStatus,
  updateContractRetentionDueDate,
} from '@/lib/services/contractor-controls.service';
import { evaluateGuaranteeAndRetentionAlert } from '@/lib/utils/contractor-controls';
import { uploadPrivateFile, getSignedFileUrl, SIGNED_URL_EXPIRY_SECONDS } from '@/lib/utils/secure-storage';

const GUARANTEE_LABELS: Record<string, string> = {
  PERFORMANCE_BOND: 'Jaminan Pelaksanaan',
  ADVANCE_PAYMENT_BOND: 'Jaminan Uang Muka',
  MAINTENANCE_BOND: 'Jaminan Pemeliharaan',
  BID_BOND: 'Jaminan Penawaran',
};

interface Props {
  projectId: string;
  contract: any;
  onContractUpdated?: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function BankGuaranteeManager({ projectId, contract, onContractUpdated, showToast }: Props) {
  const { can } = useRole(projectId);
  const canEdit = can('TERMIN_CREATE') || can('APPROVE_FINANCE');

  const [guarantees, setGuarantees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Retention Maturity Date editor
  const [retentionDue, setRetentionDue] = useState<string>(contract?.retention_due_date || '');
  const [savingDue, setSavingDue] = useState(false);

  // Modal Tambah Bank Garansi
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gType, setGType] = useState<'PERFORMANCE_BOND' | 'ADVANCE_PAYMENT_BOND' | 'MAINTENANCE_BOND' | 'BID_BOND'>('PERFORMANCE_BOND');
  const [gNumber, setGNumber] = useState('');
  const [issuingBank, setIssuingBank] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listBankGuarantees(projectId);
      setGuarantees(data || []);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memuat data Bank Garansi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    setRetentionDue(contract?.retention_due_date || '');
  }, [contract?.retention_due_date]);

  const retentionAlert = evaluateGuaranteeAndRetentionAlert(retentionDue);

  const handleSaveRetentionDue = async () => {
    if (!contract?.id) return;
    setSavingDue(true);
    try {
      await updateContractRetentionDueDate(contract.id, projectId, retentionDue || null);
      showToast('Tanggal jatuh tempo pencairan retensi disimpan!', 'success');
      onContractUpdated?.();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan jatuh tempo retensi.', 'error');
    } finally {
      setSavingDue(false);
    }
  };

  const handleSaveGuarantee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gNumber.trim() || !issuingBank.trim() || !expiryDate || Number(amount) <= 0) {
      return showToast('Lengkapi nomor jaminan, bank penerbit, nominal, dan tanggal kedaluwarsa.', 'error');
    }
    setSaving(true);
    try {
      let docPath: string | null = null;
      if (docFile) {
        const ext = docFile.name.split('.').pop() || 'pdf';
        docPath = await uploadPrivateFile(
          'evidence',
          `${projectId}/bg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`,
          docFile
        );
      }

      await createBankGuarantee({
        project_id: projectId,
        contract_id: contract?.id || null,
        guarantee_type: gType,
        guarantee_number: gNumber.trim(),
        issuing_bank: issuingBank.trim(),
        amount: Number(amount),
        issue_date: issueDate,
        expiry_date: expiryDate,
        document_url: docPath,
        notes: notes.trim() || null,
      });

      showToast('Bank Garansi berhasil dicatat!', 'success');
      setModalOpen(false);
      setGNumber('');
      setIssuingBank('');
      setAmount('');
      setExpiryDate('');
      setNotes('');
      setDocFile(null);
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan Bank Garansi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDoc = async (path: string) => {
    const signedUrl = await getSignedFileUrl('evidence', path, SIGNED_URL_EXPIRY_SECONDS);
    if (signedUrl) window.open(signedUrl, '_blank', 'noopener,noreferrer');
    else showToast('Gagal membuat tautan Signed URL dokumen.', 'error');
  };

  const handleRelease = async (id: string) => {
    try {
      await updateBankGuaranteeStatus(id, projectId, 'Released');
      showToast('Status Bank Garansi diperbarui menjadi Released (Dikembalikan).', 'success');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal memperbarui status.', 'error');
    }
  };

  const formatRp = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  const badgeStyle = (sev: string) => {
    if (sev === 'EXPIRED') return 'bg-rose-100 text-rose-700 border-rose-300';
    if (sev === 'CRITICAL_7D') return 'bg-red-100 text-red-700 border-red-200';
    if (sev === 'WARNING_14D') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (sev === 'UPCOMING_30D') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Panel Pengingat Jatuh Tempo Pencairan Retensi */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <CalendarClock className="w-4 h-4 text-amber-600" /> Pengingat Jatuh Tempo Pencairan Retensi (FHO)
          </h3>
          <p className="text-xs text-slate-500">
            Atur tanggal jatuh tempo masa pemeliharaan kontrak agar sistem otomatis memberi peringatan H-30 / H-14 / H-7.
          </p>
          {retentionDue && (
            <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle(retentionAlert.severity)}`}>
              {retentionAlert.requiresAction ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              {retentionAlert.label}
            </span>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={retentionDue}
              onChange={(e) => setRetentionDue(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            />
            <button
              onClick={handleSaveRetentionDue}
              disabled={savingDue}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {savingDue ? 'Menyimpan...' : 'Simpan Jadwal'}
            </button>
          </div>
        )}
      </div>

      {/* Header Daftar Bank Garansi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-600" /> Daftar Bank Garansi &amp; Surety Bond
          </h3>
          <p className="text-xs text-slate-500">
            Pantau masa berlaku Jaminan Pelaksanaan, Uang Muka, dan Pemeliharaan agar tidak kedaluwarsa sebelum pencairan.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Bank Garansi
          </button>
        )}
      </div>

      {/* Tabel Bank Garansi */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
            <tr>
              <th className="p-3.5 font-bold">Jenis &amp; No. Garansi</th>
              <th className="p-3.5 font-bold">Bank Penerbit</th>
              <th className="p-3.5 font-bold text-right">Nilai Jaminan</th>
              <th className="p-3.5 font-bold text-center">Berlaku s/d</th>
              <th className="p-3.5 font-bold text-center">Pengingat</th>
              <th className="p-3.5 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Memuat Bank Garansi...
                </td>
              </tr>
            ) : guarantees.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400 italic">
                  Belum ada data Bank Garansi untuk proyek ini.
                </td>
              </tr>
            ) : (
              guarantees.map((bg) => {
                const alert = evaluateGuaranteeAndRetentionAlert(bg.expiry_date);
                return (
                  <tr key={bg.id} className="hover:bg-slate-50">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{GUARANTEE_LABELS[bg.guarantee_type] || bg.guarantee_type}</div>
                      <div className="font-mono text-xs text-indigo-600">{bg.guarantee_number}</div>
                    </td>
                    <td className="p-3.5 text-xs font-semibold text-slate-700">{bg.issuing_bank}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-800">{formatRp(bg.amount)}</td>
                    <td className="p-3.5 text-center font-mono text-xs">
                      {new Date(bg.expiry_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="p-3.5 text-center">
                      {bg.status === 'Released' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                          Released (Selesai)
                        </span>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle(alert.severity)}`}>
                          {alert.label}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {bg.document_url && (
                          <button
                            onClick={() => handleOpenDoc(bg.document_url)}
                            className="text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Dokumen
                          </button>
                        )}
                        {bg.status === 'Active' && canEdit && (
                          <button
                            onClick={() => handleRelease(bg.id)}
                            className="text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" /> Tandai Released
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

      {/* Modal Tambah Bank Garansi */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveGuarantee} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-600" /> Tambah Bank Garansi
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jenis Jaminan *</label>
                <select value={gType} onChange={(e) => setGType(e.target.value as any)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="PERFORMANCE_BOND">Jaminan Pelaksanaan</option>
                  <option value="ADVANCE_PAYMENT_BOND">Jaminan Uang Muka</option>
                  <option value="MAINTENANCE_BOND">Jaminan Pemeliharaan</option>
                  <option value="BID_BOND">Jaminan Penawaran</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">No. Bank Garansi *</label>
                <input required value={gNumber} onChange={(e) => setGNumber(e.target.value)} placeholder="BG/BMRI/2026/001" className="w-full border rounded-lg p-2 text-sm font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Bank / Asuransi Penerbit *</label>
                <input required value={issuingBank} onChange={(e) => setIssuingBank(e.target.value)} placeholder="Bank Mandiri / Jamkrindo" className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nilai Jaminan (Rp) *</label>
                <input required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Terbit</label>
                <input required type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Kedaluwarsa *</label>
                <input required type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Scan Dokumen Bank Garansi (Private 10m Signed URL)</label>
              <label className="cursor-pointer border rounded-lg px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span className="truncate">{docFile ? docFile.name : 'Unggah PDF / Foto Jaminan'}</span>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Catatan</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan Garansi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
