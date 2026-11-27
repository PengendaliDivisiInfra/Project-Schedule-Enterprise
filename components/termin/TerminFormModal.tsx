'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useRole } from '@/lib/hooks/useRole';
import { useCOA } from '@/lib/hooks/useCOA';
import { createTerminDraft } from '@/lib/services/termin.service';
import { getVerifiedBakpProgress } from '@/lib/services/contractor-controls.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  contractId: string;
  contractValue?: number;
  defaultRetentionPct?: number;
  defaultPpnPct?: number;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function TerminFormModal({
  isOpen,
  onClose,
  projectId,
  contractId,
  contractValue = 0,
  defaultRetentionPct = 5,
  defaultPpnPct = 11,
  onSuccess,
  showToast,
}: Props) {
  const { can } = useRole(projectId);
  const { getAccountCode } = useCOA();
  const canViewPrice = can('VIEW_PRICE');

  const [loading, setLoading] = useState(false);
  const [pullingBakp, setPullingBakp] = useState(false);
  const [form, setForm] = useState({
    termin_no: 1,
    name: '',
    planned_progress_pct: 0,
    previous_progress_pct: 0,
    actual_progress_pct: 0,
    gross_amount: 0,
    retention_pct: defaultRetentionPct,
    bakp_number: '',
    bakp_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  if (!isOpen) return null;

  const handlePullBakpProgress = async () => {
    setPullingBakp(true);
    try {
      const bakp = await getVerifiedBakpProgress(
        projectId,
        contractValue,
        form.retention_pct,
        defaultPpnPct
      );
      setForm((prev) => ({
        ...prev,
        previous_progress_pct: bakp.previousProgressPct,
        actual_progress_pct: bakp.weightedActualProgressPct,
        gross_amount: bakp.grossAmount,
        name: prev.name || `Termin Progress ${bakp.weightedActualProgressPct}% (BAKP)`,
      }));
      showToast(
        `Progres BAKP ditarik otomatis: Aktual ${bakp.weightedActualProgressPct}% (Delta +${bakp.deltaProgressPct}%) = DPP Rp ${bakp.grossAmount.toLocaleString('id-ID')}`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Gagal menarik bobot progres BAKP.', 'error');
    } finally {
      setPullingBakp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dynamicCoa = {
        coa_kas: getAccountCode('Kas dan Bank Proyek') || '1111',
        coa_pendapatan: getAccountCode('Pendapatan Jasa Konstruksi') || '4111',
        coa_ppn: getAccountCode('Utang PPN Keluaran') || '2141',
        coa_pph: getAccountCode('PPh Pasal 4(2)') || '5901',
        coa_dp: getAccountCode('Kasbon Mandor') || '1152',
        coa_retensi: getAccountCode('Retensi Proyek') || '1154',
      };

      const payload = {
        ...form,
        bakp_number: form.bakp_number || null,
        bakp_date: form.bakp_date || null,
        bakp_verified_progress_pct: form.actual_progress_pct,
        project_id: projectId,
        contract_id: contractId,
        ...dynamicCoa,
      };

      await createTerminDraft(payload as any);

      showToast('Draft termin berbasis BAKP berhasil dibuat', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">Buat Draft Termin (BAKP)</h2>
          <button
            type="button"
            onClick={handlePullBakpProgress}
            disabled={pullingBakp}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pullingBakp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Tarik Progres BAKP Otomatis
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">No. Termin</label>
              <input type="number" required min={1} value={form.termin_no} onChange={(e) => setForm({ ...form, termin_no: Number(e.target.value) })} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nama Termin</label>
              <input type="text" required placeholder="Cth: Termin 1 (BAKP 25%)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-indigo-50/60 p-3 rounded-lg border border-indigo-100">
            <div>
              <label className="block text-xs font-bold text-indigo-800 mb-1">No. BAKP (Berita Acara)</label>
              <input type="text" placeholder="BAKP/2026/001" value={form.bakp_number} onChange={(e) => setForm({ ...form, bakp_number: e.target.value })} className="w-full border border-indigo-200 rounded-lg p-2 text-sm bg-white font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-800 mb-1">Tanggal BAKP</label>
              <input type="date" value={form.bakp_date} onChange={(e) => setForm({ ...form, bakp_date: e.target.value })} className="w-full border border-indigo-200 rounded-lg p-2 text-sm bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Rencana (%)</label>
              <input type="number" step="0.01" required value={form.planned_progress_pct} onChange={(e) => setForm({ ...form, planned_progress_pct: Number(e.target.value) })} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Progres Lalu (%)</label>
              <input type="number" step="0.01" required value={form.previous_progress_pct} onChange={(e) => setForm({ ...form, previous_progress_pct: Number(e.target.value) })} className="w-full border rounded-lg p-2 text-sm bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Aktual BAKP (%)</label>
              <input type="number" step="0.01" required value={form.actual_progress_pct} onChange={(e) => setForm({ ...form, actual_progress_pct: Number(e.target.value) })} className="w-full border rounded-lg p-2 text-sm font-bold text-indigo-700" />
            </div>
          </div>

          {canViewPrice && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nilai Progres / DPP (Rp)</label>
                <input type="number" step="0.01" required value={form.gross_amount} onChange={(e) => setForm({ ...form, gross_amount: Number(e.target.value) })} className="w-full border rounded-lg p-2 text-sm font-mono font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Retensi (%)</label>
                <input type="number" step="0.01" required value={form.retention_pct} onChange={(e) => setForm({ ...form, retention_pct: Number(e.target.value) })} className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Catatan (Opsional)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg p-2 text-sm" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600 hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
