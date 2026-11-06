'use client';

import { useState } from 'react';
import { createContract } from '@/lib/services/termin.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function ContractFormModal({ isOpen, onClose, projectId, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    contract_number: '',
    contract_name: '',
    contract_value: 0,
    retention_pct: 5,
    ppn_pct: 11,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createContract({
        ...form,
        project_id: projectId,
      });
      showToast('Kontrak berhasil dibuat', 'success');
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
        <h2 className="text-xl font-bold mb-4">Buat Kontrak Klien Baru</h2>
        <p className="text-sm text-slate-500 mb-4">Kontrak ini menjadi dasar perhitungan Termin dan Retensi proyek.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nomor Kontrak</label>
            <input type="text" required placeholder="Cth: KTR/2026/001" value={form.contract_number} onChange={e => setForm({...form, contract_number: e.target.value})} className="w-full border rounded p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Kontrak</label>
            <input type="text" required placeholder="Cth: Pembangunan Gedung A" value={form.contract_name} onChange={e => setForm({...form, contract_name: e.target.value})} className="w-full border rounded p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nilai Kontrak (Rp)</label>
            <input type="number" step="0.01" required value={form.contract_value} onChange={e => setForm({...form, contract_value: Number(e.target.value)})} className="w-full border rounded p-2 font-bold" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Retensi (%)</label>
              <input type="number" step="0.01" required value={form.retention_pct} onChange={e => setForm({...form, retention_pct: Number(e.target.value)})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PPN (%)</label>
              <input type="number" step="0.01" required value={form.ppn_pct} onChange={e => setForm({...form, ppn_pct: Number(e.target.value)})} className="w-full border rounded p-2" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Kontrak'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}