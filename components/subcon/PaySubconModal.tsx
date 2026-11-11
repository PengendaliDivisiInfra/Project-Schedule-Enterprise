'use client';

import { useState, useEffect } from 'react';
import { paySubcontractor } from '@/lib/services/subcon.service';
import { SubcontractorContract } from '@/lib/types/subcon';
import { MoneyText } from '@/components/ui/MoneyText';
import { Wallet, X, Save, Loader2 } from 'lucide-react';

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
    category: 'Kasbon',
    payment_method: 'Transfer',
  });

  useEffect(() => {
    if (isOpen && spk) {
      setForm({
        payment_type: 'Opname',
        payment_number: `PAY/${new Date().getFullYear()}/${new Date().getMonth()+1}/${Math.floor(Math.random() * 100)}`,
        payment_date: new Date().toISOString().split('T')[0],
        progress_pct: 0, amount: 0, description: '',
        ppn_pct: spk.ppn_pct ?? 11, pph_pct: spk.pph_pct ?? 2,
        category: 'Kasbon', payment_method: 'Transfer',
      });
    }
  }, [isOpen, spk]);

  if (!isOpen || !spk) return null;

  const grossAmount = form.payment_type === 'Opname' ? (form.progress_pct / 100) * spk.final_contract_value : form.amount;
  const ppnAmount = (grossAmount * form.ppn_pct) / 100;
  const pphAmount = (grossAmount * form.pph_pct) / 100;
  const retentionAmount = form.payment_type === 'Opname' ? (grossAmount * spk.retention_pct) / 100 : 0; 
  const netAmount = grossAmount + ppnAmount - pphAmount - retentionAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grossAmount <= 0) return showToast('Nominal pembayaran harus lebih dari 0', 'error');
    
    setLoading(true);
    try {
      await paySubcontractor(spk.id, {
        payment_number: form.payment_number, payment_date: form.payment_date, amount: grossAmount,
        description: form.description, payment_type: form.payment_type, progress_pct: form.progress_pct,
        ppn_amount: ppnAmount, pph_amount: pphAmount,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-indigo-600" /> Pembayaran Subkon</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 bg-white p-1.5 rounded-lg border border-slate-200 transition-colors"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh]">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 bg-slate-50 p-2 rounded-lg border border-slate-200">SPK: {spk.spk_number} - {spk.subcontractor_name}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl shadow-inner">
              <button type="button" onClick={() => setForm({ ...form, payment_type: 'Opname', amount: 0 })}
                className={`py-2.5 text-sm font-bold rounded-lg transition-all ${form.payment_type === 'Opname' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                Opname
              </button>
              <button type="button" onClick={() => setForm({ ...form, payment_type: 'Kasbon', progress_pct: 0 })}
                className={`py-2.5 text-sm font-bold rounded-lg transition-all ${form.payment_type === 'Kasbon' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>
                Kasbon
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">No. Pembayaran</label>
                <input type="text" required value={form.payment_number} onChange={e => setForm({...form, payment_number: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tanggal</label>
                <input type="date" required value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" />
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm">
              {form.payment_type === 'Opname' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Progres Pekerjaan (%)</label>
                  <div className="relative">
                    <input type="number" step="0.01" required min="1" max="100" value={form.progress_pct} onChange={e => setForm({...form, progress_pct: Number(e.target.value)})} className="w-full border border-slate-300 rounded-xl p-3 font-bold text-lg pr-10 outline-none focus:border-indigo-500 tabular-nums" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wider">Nominal Kasbon (Rp)</label>
                    <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="w-full border border-amber-300 bg-amber-50 rounded-xl p-3 font-bold text-lg outline-none focus:border-amber-500 tabular-nums" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kategori</label>
                      <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500 bg-white">
                        <option value="Kasbon">Kasbon</option><option value="K3">K3</option><option value="Alat">Alat</option><option value="DLL">DLL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Metode</label>
                      <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500 bg-white">
                        <option value="Transfer">Transfer</option><option value="Cash">Cash</option><option value="BG">BG</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {form.payment_type === 'Opname' && (
                <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">PPN (%)</label>
                    <input type="number" step="0.01" required value={form.ppn_pct} onChange={e => setForm({...form, ppn_pct: Number(e.target.value)})} className="w-full border border-slate-300 rounded-xl p-2 text-sm outline-none focus:border-indigo-500 tabular-nums" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">PPh (%)</label>
                    <input type="number" step="0.01" required value={form.pph_pct} onChange={e => setForm({...form, pph_pct: Number(e.target.value)})} className="w-full border border-slate-300 rounded-xl p-2 text-sm outline-none focus:border-indigo-500 tabular-nums" />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center text-sm text-slate-600 font-medium">
                  <span>Bruto:</span><span className="tabular-nums font-bold"><MoneyText value={grossAmount} /></span>
                </div>
                {form.payment_type === 'Opname' && (
                  <>
                    <div className="flex justify-between items-center text-sm text-blue-600 font-medium"><span>PPN:</span><span className="tabular-nums">+ <MoneyText value={ppnAmount} /></span></div>
                    <div className="flex justify-between items-center text-sm text-orange-600 font-medium"><span>PPh:</span><span className="tabular-nums">- <MoneyText value={pphAmount} /></span></div>
                    <div className="flex justify-between items-center text-sm text-rose-600 font-medium"><span>Retensi:</span><span className="tabular-nums">- <MoneyText value={retentionAmount} /></span></div>
                  </>
                )}
                <div className="flex justify-between items-center text-base font-bold text-emerald-700 pt-3 mt-2 border-t border-slate-200 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                  <span>Dana Ditransfer:</span><span className="tabular-nums"><MoneyText value={netAmount} /></span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-6">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors" disabled={loading}>Batal</button>
              <button type="submit" className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md flex items-center gap-2 transition-all ${form.payment_type === 'Opname' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'}`} disabled={loading}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {loading ? 'Memproses...' : `Bayar ${form.payment_type}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}