'use client';

import { useState, useEffect } from 'react';
import { paySubcontractor } from '@/lib/services/subcon.service';
import { SubcontractorContract } from '@/lib/types/subcon';
import { MoneyText } from '@/components/ui/MoneyText';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  spk: (SubcontractorContract & { final_contract_value: number, total_kasbon: number }) | null;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function PaySubconModal({ isOpen, onClose, spk, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    payment_type: 'Opname' as 'Kasbon' | 'Opname',
    payment_number: `PAY/${new Date().getFullYear()}/${new Date().getMonth()+1}/${Math.floor(Math.random() * 100)}`,
    payment_date: new Date().toISOString().split('T')[0],
    progress_pct: 0,
    amount: 0,
    description: '',
    ppn_pct: 11,
    pph_pct: 2,
    category: 'Kasbon', // Default Kategori
    payment_method: 'Transfer', // Default Metode
  });

  useEffect(() => {
    if (isOpen && spk) {
      setForm({
        payment_type: 'Opname',
        payment_number: `PAY/${new Date().getFullYear()}/${new Date().getMonth()+1}/${Math.floor(Math.random() * 100)}`,
        payment_date: new Date().toISOString().split('T')[0],
        progress_pct: 0,
        amount: 0,
        description: '',
        ppn_pct: spk.ppn_pct ?? 11,
        pph_pct: spk.pph_pct ?? 2,
        category: 'Kasbon',
        payment_method: 'Transfer',
      });
    }
  }, [isOpen, spk]);

  if (!isOpen || !spk) return null;

  const grossAmount = form.payment_type === 'Opname' 
    ? (form.progress_pct / 100) * spk.final_contract_value 
    : form.amount;
    
  const ppnAmount = (grossAmount * form.ppn_pct) / 100;
  const pphAmount = (grossAmount * form.pph_pct) / 100;
  const retentionAmount = form.payment_type === 'Opname' ? (grossAmount * spk.retention_pct) / 100 : 0; 
  const netAmount = grossAmount + ppnAmount - pphAmount - retentionAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grossAmount <= 0) {
      showToast('Nominal pembayaran harus lebih dari 0', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await paySubcontractor(spk.id, {
        payment_number: form.payment_number,
        payment_date: form.payment_date,
        amount: grossAmount,
        description: form.description,
        payment_type: form.payment_type,
        progress_pct: form.progress_pct,
        ppn_amount: ppnAmount,
        pph_amount: pphAmount,
        category: form.payment_type === 'Kasbon' ? form.category : undefined,
        payment_method: form.payment_method
      });
      showToast(`Pembayaran ${form.payment_type} berhasil dicatat`, 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2">Pembayaran Subkon</h2>
        <p className="text-sm text-slate-500 mb-4">SPK: {spk.spk_number} - {spk.subcontractor_name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
            <button type="button" onClick={() => setForm({ ...form, payment_type: 'Opname', amount: 0 })}
              className={`py-2 text-sm font-bold rounded-md transition-colors ${form.payment_type === 'Opname' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
              Opname
            </button>
            <button type="button" onClick={() => setForm({ ...form, payment_type: 'Kasbon', progress_pct: 0 })}
              className={`py-2 text-sm font-bold rounded-md transition-colors ${form.payment_type === 'Kasbon' ? 'bg-white shadow text-amber-600' : 'text-slate-500'}`}>
              Kasbon
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">No. Pembayaran</label>
              <input type="text" required value={form.payment_number} onChange={e => setForm({...form, payment_number: e.target.value})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal</label>
              <input type="date" required value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            {form.payment_type === 'Opname' ? (
              <div>
                <label className="block text-sm font-bold mb-1">Progres Pekerjaan (%)</label>
                <div className="relative">
                  <input type="number" step="0.01" required min="1" max="100" value={form.progress_pct} onChange={e => setForm({...form, progress_pct: Number(e.target.value)})} className="w-full border rounded p-2 font-bold text-lg pr-10" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-bold mb-1 text-amber-700">Nominal Kasbon (Rp)</label>
                  <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="w-full border border-amber-300 bg-amber-50 rounded p-2 font-bold text-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border rounded p-1.5 text-sm">
                      <option value="Kasbon">Kasbon</option>
                      <option value="K3">K3</option>
                      <option value="Alat">Alat</option>
                      <option value="DLL">DLL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Metode</label>
                    <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} className="w-full border rounded p-1.5 text-sm">
                      <option value="Transfer">Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="BG">BG</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {form.payment_type === 'Opname' && (
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">PPN (%)</label>
                  <input type="number" step="0.01" required value={form.ppn_pct} onChange={e => setForm({...form, ppn_pct: Number(e.target.value)})} className="w-full border rounded p-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">PPh (%)</label>
                  <input type="number" step="0.01" required value={form.pph_pct} onChange={e => setForm({...form, pph_pct: Number(e.target.value)})} className="w-full border rounded p-1.5 text-sm" />
                </div>
              </div>
            )}

            <div className="space-y-1 border-t pt-2">
              <div className="flex justify-between items-center text-sm text-slate-600">
                <span>Bruto:</span><MoneyText value={grossAmount} />
              </div>
              {form.payment_type === 'Opname' && (
                <>
                  <div className="flex justify-between items-center text-sm text-blue-600"><span>PPN:</span><span>+ <MoneyText value={ppnAmount} /></span></div>
                  <div className="flex justify-between items-center text-sm text-orange-600"><span>PPh:</span><span>- <MoneyText value={pphAmount} /></span></div>
                  <div className="flex justify-between items-center text-sm text-red-600"><span>Retensi:</span><span>- <MoneyText value={retentionAmount} /></span></div>
                </>
              )}
              <div className="flex justify-between items-center text-sm font-bold text-green-700 pt-2 mt-2 border-t">
                <span>Dana Ditransfer:</span><MoneyText value={netAmount} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className={`px-4 py-2 text-white rounded font-bold ${form.payment_type === 'Opname' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`} disabled={loading}>
              {loading ? 'Memproses...' : `Bayar ${form.payment_type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}