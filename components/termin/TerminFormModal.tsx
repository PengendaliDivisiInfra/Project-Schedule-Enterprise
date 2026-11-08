'use client';

import { useState } from 'react';
import { useRole } from '@/lib/hooks/useRole';
import { useCOA } from '@/lib/hooks/useCOA'; // Import Hook COA
import { createTerminDraft } from '@/lib/services/termin.service';
import { ProjectTermin } from '@/lib/types/termin';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  contractId: string;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function TerminFormModal({ isOpen, onClose, projectId, contractId, onSuccess, showToast }: Props) {
  const { can } = useRole();
  const { getAccountCode } = useCOA(); // Panggil Hook COA
  const canViewPrice = can('VIEW_PRICE');

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    termin_no: 1,
    name: '',
    planned_progress_pct: 0,
    previous_progress_pct: 0,
    actual_progress_pct: 0,
    gross_amount: 0,
    retention_pct: 5,
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Tarik Kode COA secara Dinamis dari Master COA
      const dynamicCoa = {
        coa_kas: getAccountCode('Kas dan Bank Proyek') || '1111',
        coa_pendapatan: getAccountCode('Pendapatan Jasa Konstruksi') || '4111',
        coa_ppn: getAccountCode('Utang PPN Keluaran') || '2141',
        coa_pph: getAccountCode('PPh Pasal 4(2)') || '5901',
        coa_dp: getAccountCode('Kasbon Mandor') || '1152', 
        coa_retensi: getAccountCode('Retensi Proyek') || '1154',
      };

      // 2. Gabungkan dengan form data
      const payload = {
        ...form,
        project_id: projectId,
        contract_id: contractId,
        ...dynamicCoa // Suntikkan kode COA ke payload
      };

      // 3. Simpan ke database (Service Anda sudah menangani perhitungan retensi)
      await createTerminDraft(payload as any); // Gunakan 'as any' jika tipe CreateTerminInput belum diupdate
      
      showToast('Draft termin berhasil dibuat', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Buat Draft Termin</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">No. Termin</label>
              <input type="number" required min={1} value={form.termin_no} onChange={e => setForm({...form, termin_no: Number(e.target.value)})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Termin</label>
              <input type="text" required placeholder="Cth: Termin 1 (DP)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Progres Rencana (%)</label>
              <input type="number" step="0.01" required value={form.planned_progress_pct} onChange={e => setForm({...form, planned_progress_pct: Number(e.target.value)})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Progres Aktual (%)</label>
              <input type="number" step="0.01" required value={form.actual_progress_pct} onChange={e => setForm({...form, actual_progress_pct: Number(e.target.value)})} className="w-full border rounded p-2" />
            </div>
          </div>

          {canViewPrice && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border">
              <div>
                <label className="block text-sm font-medium mb-1">Nilai Progres / DPP (Rp)</label>
                <input type="number" step="0.01" required value={form.gross_amount} onChange={e => setForm({...form, gross_amount: Number(e.target.value)})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Retensi (%)</label>
                <input type="number" step="0.01" required value={form.retention_pct} onChange={e => setForm({...form, retention_pct: Number(e.target.value)})} className="w-full border rounded p-2" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Catatan (Opsional)</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border rounded p-2" rows={2} />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}