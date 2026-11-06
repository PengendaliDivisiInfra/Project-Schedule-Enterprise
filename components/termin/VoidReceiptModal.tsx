'use client';

import { useState } from 'react';
import { ClientReceipt } from '@/lib/types/termin';
import { voidReceipt } from '@/lib/services/cash-in.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  receipt: ClientReceipt | null;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function VoidReceiptModal({ isOpen, onClose, receipt, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  if (!isOpen || !receipt) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 5) {
      showToast('Alasan minimal 5 karakter', 'error');
      return;
    }

    setLoading(true);
    try {
      await voidReceipt(receipt.id, reason);
      showToast('Kas masuk berhasil di-void (Jurnal Pembalik dibuat)', 'success');
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
        <h2 className="text-xl font-bold mb-2 text-red-600">Void Penerimaan Kas</h2>
        <p className="text-sm text-slate-600 mb-4">
          Tindakan ini tidak akan menghapus data. Sistem akan membuat <strong>Jurnal Pembalik (Pengeluaran)</strong> otomatis untuk menjaga Audit Trail.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Alasan Pembatalan (Wajib)</label>
            <textarea required rows={3} value={reason} onChange={e => setReason(e.target.value)} className="w-full border rounded p-2" placeholder="Cth: Salah input nominal transfer" />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" disabled={loading}>
              {loading ? 'Memproses...' : 'Ya, Void Kas Ini'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}