'use client';

import { useState } from 'react';
import { ClientInvoiceSummary } from '@/lib/types/termin';
import { recordReceipt } from '@/lib/services/cash-in.service';
import { MoneyText } from '@/components/ui/MoneyText';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoice: ClientInvoiceSummary | null;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function ReceiptModal({ isOpen, onClose, invoice, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    receipt_number: `KW/${new Date().getFullYear()}/${new Date().getMonth()+1}/001`,
    receipt_date: new Date().toISOString().split('T')[0],
    amount: 0,
    bank_name: '',
    reference_no: '',
    notes: '',
  });

  if (!isOpen || !invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.amount <= 0 || form.amount > invoice.outstanding) {
      showToast('Jumlah tidak valid atau melebihi sisa tagihan', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await recordReceipt({
        ...form,
        invoice_id: invoice.id,
      });
      showToast('Kas masuk berhasil dicatat', 'success');
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
        <h2 className="text-xl font-bold mb-2">Catat Penerimaan Kas</h2>
        <div className="bg-slate-50 p-3 rounded mb-4 text-sm flex justify-between">
          <span>Sisa Tagihan (Outstanding):</span>
          <span className="font-bold text-red-600"><MoneyText value={invoice.outstanding} /></span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">No. Kuitansi</label>
              <input type="text" required value={form.receipt_number} onChange={e => setForm({...form, receipt_number: e.target.value})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Terima</label>
              <input type="date" required value={form.receipt_date} onChange={e => setForm({...form, receipt_date: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah Diterima (Rp)</label>
            <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="w-full border rounded p-2 font-bold text-green-700" />
            <p className="text-xs text-slate-500 mt-1">Maksimal: {new Intl.NumberFormat('id-ID').format(invoice.outstanding)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Bank</label>
              <input type="text" placeholder="Cth: BCA" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">No. Referensi</label>
              <input type="text" placeholder="No Transfer" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Kas Masuk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}