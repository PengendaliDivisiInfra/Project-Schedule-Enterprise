'use client';

import { useState } from 'react';
import { issueInvoice } from '@/lib/services/termin.service';
import { ProjectTermin } from '@/lib/types/termin';
import { MoneyText } from '@/components/ui/MoneyText';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  termin: ProjectTermin | null;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function InvoiceModal({ isOpen, onClose, termin, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    ppn_pct: 11,
    notes: '',
  });

  if (!isOpen || !termin) return null;

  // Preview Kalkulasi
  const dpp = termin.gross_amount;
  const ppn = (dpp * form.ppn_pct) / 100;
  const totalInvoice = dpp + ppn;
  const retention = termin.retention_amount;
  const netPayable = totalInvoice - retention;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await issueInvoice({
        ...form,
        termin_id: termin.id,
      });
      showToast('Invoice berhasil diterbitkan', 'success');
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-4">Terbitkan Invoice</h2>
        
        {/* Preview Kalkulasi */}
        <div className="bg-blue-50 p-4 rounded-lg mb-4 text-sm border border-blue-100">
          <div className="flex justify-between mb-1"><span>DPP (Nilai Progres):</span> <MoneyText value={dpp} /></div>
          <div className="flex justify-between mb-1"><span>PPN ({form.ppn_pct}%):</span> <MoneyText value={ppn} /></div>
          <div className="flex justify-between font-semibold border-t border-blue-200 pt-1 mb-1"><span>Total Invoice (Faktur):</span> <MoneyText value={totalInvoice} /></div>
          <div className="flex justify-between text-red-600 mb-1"><span>Retensi (Potongan):</span> <MoneyText value={-retention} /></div>
          <div className="flex justify-between font-bold text-green-700 bg-green-100 p-1 rounded mt-2"><span>Net Dibayar Klien:</span> <MoneyText value={netPayable} /></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">No. Invoice</label>
              <input type="text" required placeholder="INV/2026/..." value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Invoice</label>
              <input type="date" required value={form.invoice_date} onChange={e => setForm({...form, invoice_date: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Jatuh Tempo (Opsional)</label>
              <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PPN (%)</label>
              <input type="number" step="0.01" required value={form.ppn_pct} onChange={e => setForm({...form, ppn_pct: Number(e.target.value)})} className="w-full border rounded p-2" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>
              {loading ? 'Memproses...' : 'Terbitkan Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}