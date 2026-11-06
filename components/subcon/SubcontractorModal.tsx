'use client';

import { useState } from 'react';
import { createSubcontractor } from '@/lib/services/subcon.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function SubcontractorModal({ isOpen, onClose, projectId, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    address: '',
    contact_person: '',
    phone: '',
    bank_name: '',
    bank_account: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createSubcontractor({
        ...form,
        project_id: projectId,
      });
      showToast('Vendor subkon berhasil ditambahkan', 'success');
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Tambah Vendor Subkon</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Perusahaan</label>
            <input type="text" required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} className="w-full border rounded p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Alamat Perusahaan</label>
            <textarea rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full border rounded p-2" placeholder="Alamat lengkap..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Contact Person</label>
              <input type="text" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">No. Telepon</label>
              <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bank</label>
              <input type="text" placeholder="Cth: BCA" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">No. Rekening</label>
              <input type="text" value={form.bank_account} onChange={e => setForm({...form, bank_account: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}