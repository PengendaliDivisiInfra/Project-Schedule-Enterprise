'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Subcontractor } from '@/lib/types/subcon';

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

  // 👇 LOGIKA DROPDOWN PPH (Termasuk 0%) 👇
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-xl font-bold mb-4">{isEditMode ? 'Edit Vendor Subkon' : 'Tambah Vendor Subkon'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium mb-1">Nama Perusahaan</label>
              <input type="text" required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact Person (Mandor/PIC)</label>
              <input type="text" required value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Alamat Perusahaan</label>
            <textarea required value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full border rounded p-2" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bank</label>
              <input type="text" required value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} className="w-full border rounded p-2" placeholder="Cth: BCA" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">No. Rekening</label>
              <input type="text" required value={form.bank_account} onChange={e => setForm({...form, bank_account: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>

          {/* DROPDOWN PPh FINAL DENGAN OPSI 0% */}
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <label className="block text-sm font-bold text-amber-800 mb-2">Kualifikasi SBU & Tarif PPh Final (PP No. 9/2022)</label>
            <select value={form.pph_category} onChange={handlePphChange} className="w-full border rounded p-2 text-sm bg-white">
              <option value="Kecil (1.75%)">Pelaksanaan Konstruksi - Kualifikasi Kecil (1.75%)</option>
              <option value="Menengah/Besar (2.65%)">Pelaksanaan Konstruksi - Kualifikasi Menengah/Besar/EPC (2.65%)</option>
              <option value="Tanpa SBU (4.00%)">Pelaksanaan Konstruksi - Tanpa Sertifikasi SBU (4.00%)</option>
              <option value="Konsultan (3.50%)">Jasa Konsultansi Konstruksi (3.50%)</option>
              <option value="Tanpa PPh (0%)">Tanpa PPh Final (0%)</option> {/* <-- OPSI BARU */}
            </select>
            <p className="text-xs text-amber-700 mt-2">*Tarif ini akan otomatis digunakan pada saat pembuatan SPK.</p>
          </div>

          <div className="flex justify-end gap-3 mt-6 border-t pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}