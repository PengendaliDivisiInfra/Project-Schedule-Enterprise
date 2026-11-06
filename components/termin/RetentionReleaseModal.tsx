'use client';

import { useState } from 'react';
import { ClientContract } from '@/lib/types/termin';
import { releaseRetention } from '@/lib/services/retention.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contract: ClientContract;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function RetentionReleaseModal({ isOpen, onClose, contract, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    release_no: 1,
    release_date: new Date().toISOString().split('T')[0],
    amount: 0,
    receipt_number: `RET/${new Date().getFullYear()}/001`,
    bank_name: '',
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await releaseRetention({
        ...form,
        contract_id: contract.id,
      });
      showToast('Pencairan retensi berhasil dicatat sebagai Kas Masuk', 'success');
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
        <h2 className="text-xl font-bold mb-4">Cairkan Dana Retensi</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">No. Pencairan</label>
              <input type="number" required value={form.release_no} onChange={e => setForm({...form, release_no: Number(e.target.value)})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Cair</label>
              <input type="date" required value={form.release_date} onChange={e => setForm({...form, release_date: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nominal Retensi Dicairkan (Rp)</label>
            <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="w-full border rounded p-2 font-bold" />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">No. Kuitansi / Bukti Terima</label>
            <input type="text" required value={form.receipt_number} onChange={e => setForm({...form, receipt_number: e.target.value})} className="w-full border rounded p-2" />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>
              {loading ? 'Memproses...' : 'Cairkan Retensi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}