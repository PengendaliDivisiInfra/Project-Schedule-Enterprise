'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Subcontractor } from '@/lib/types/subcon';
import { Users, X, Save, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  editingSubcon?: Subcontractor | null;
}

export function SubcontractorModal({ isOpen, onClose, projectId, onSuccess, showToast, editingSubcon }: Props) {
  const [loading, setLoading] = useState(false);
  const isEditMode = !!editingSubcon;

  const [form, setForm] = useState({
    company_name: '',
    address: '',
    contact_person: '',
    phone: '',
    bank_name: '',
    bank_account: '',
    pph_category: 'Kecil (1.75%)',
    pph_rate: 1.75,
  });

  useEffect(() => {
    if (isOpen) {
      if (editingSubcon) {
        setForm({
          company_name: editingSubcon.company_name || '',
          address: editingSubcon.address || '',
          contact_person: editingSubcon.contact_person || '',
          phone: editingSubcon.phone || '',
          bank_name: editingSubcon.bank_name || '',
          bank_account: editingSubcon.bank_account || '',
          pph_category: editingSubcon.pph_category || 'Kecil (1.75%)',
          pph_rate: editingSubcon.pph_rate ?? 1.75,
        });
      } else {
        setForm({
          company_name: '', address: '', contact_person: '', phone: '', bank_name: '', bank_account: '',
          pph_category: 'Kecil (1.75%)', pph_rate: 1.75,
        });
      }
    }
  }, [isOpen, editingSubcon]);

  if (!isOpen) return null;

  const handlePphChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    let rate = 1.75;
    
    if (val.includes('2.65')) rate = 2.65;
    else if (val.includes('4.00')) rate = 4.00;
    else if (val.includes('3.50')) rate = 3.50;
    else if (val.includes('0%')) rate = 0;
    
    setForm({ ...form, pph_category: val, pph_rate: rate });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditMode && editingSubcon) {
        const { error } = await supabase.from('subcontractors').update(form).eq('id', editingSubcon.id);
        if (error) throw error;
        showToast('Vendor berhasil diperbarui', 'success');
      } else {
        const { error } = await supabase.from('subcontractors').insert({ ...form, project_id: projectId });
        if (error) throw error;
        showToast('Vendor berhasil ditambahkan', 'success');
      }
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-600" /> {isEditMode ? 'Edit Vendor Subkon' : 'Tambah Vendor Subkon'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 bg-white p-1.5 rounded-lg border border-slate-200 transition-colors"><X size={20}/></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Perusahaan</label>
              <input type="text" required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Contact Person (Mandor/PIC)</label>
              <input type="text" required value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Alamat Perusahaan</label>
            <textarea required value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Bank</label>
              <input type="text" required value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" placeholder="Cth: BCA" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">No. Rekening</label>
              <input type="text" required value={form.bank_account} onChange={e => setForm({...form, bank_account: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none tabular-nums" />
            </div>
          </div>

          <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 shadow-sm">
            <label className="block text-xs font-bold text-amber-800 mb-1.5 uppercase tracking-wider">Kualifikasi SBU & Tarif PPh Final (PP No. 9/2022)</label>
            <select value={form.pph_category} onChange={handlePphChange} className="w-full border border-amber-300 rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-medium text-slate-800">
              <option value="Kecil (1.75%)">Pelaksanaan Konstruksi - Kualifikasi Kecil (1.75%)</option>
              <option value="Menengah/Besar (2.65%)">Pelaksanaan Konstruksi - Kualifikasi Menengah/Besar/EPC (2.65%)</option>
              <option value="Tanpa SBU (4.00%)">Pelaksanaan Konstruksi - Tanpa Sertifikasi SBU (4.00%)</option>
              <option value="Konsultan (3.50%)">Jasa Konsultansi Konstruksi (3.50%)</option>
              <option value="Tanpa PPh (0%)">Tanpa PPh Final (0%)</option>
            </select>
            <p className="text-[11px] text-amber-700 mt-2 font-medium">*Tarif ini akan otomatis digunakan pada saat pembuatan SPK.</p>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-6">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors" disabled={loading}>Batal</button>
            <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all" disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {loading ? 'Menyimpan...' : 'Simpan Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}