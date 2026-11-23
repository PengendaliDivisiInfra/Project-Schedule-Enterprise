"use client";
import { useEffect, useState } from 'react';
import { Store, Plus, X, Edit, PowerOff, CheckCircle } from 'lucide-react';
import { getVendors, createVendor, updateVendor, deactivateVendor } from '@/lib/services/vendor-service';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { Vendor } from '@/types/purchase-order';

export function VendorManager({ projectId }: { projectId: string }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // State Modal Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    address: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: ''
  });

  // State Modal Konfirmasi Nonaktifkan
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await getVendors(projectId);
      setVendors(data);
    } catch (e: any) {
      showToast('error', e?.message || 'Gagal memuat data vendor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  const handleOpenModal = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      setFormData({
        name: vendor.name,
        contact_person: vendor.contact_person || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        bank_name: vendor.bank_name || '',
        bank_account_number: vendor.bank_account_number || '',
        bank_account_name: vendor.bank_account_name || ''
      });
    } else {
      setEditingVendor(null);
      setFormData({ name: '', contact_person: '', phone: '', address: '', bank_name: '', bank_account_number: '', bank_account_name: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return showToast('error', 'Nama Vendor wajib diisi!');

    try {
      if (editingVendor) {
        await updateVendor(editingVendor.id, formData);
        showToast('success', 'Data vendor berhasil diperbarui');
      } else {
        await createVendor({ ...formData, project_id: projectId, is_active: true });
        showToast('success', 'Vendor baru berhasil ditambahkan');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal menyimpan data vendor');
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await deactivateVendor(deactivateTarget.id);
      showToast('success', `Vendor "${deactivateTarget.name}" berhasil dinonaktifkan`);
      setDeactivateTarget(null);
      loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal menonaktifkan vendor');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="space-y-4 relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-bold flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <CheckCircle size={16} /> {toast.message}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" /> Master Data Vendor / Supplier
          </h3>
          <p className="text-sm text-slate-500">Kelola data supplier, kontak, dan informasi rekening bank.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Tambah Vendor
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b">
              <th className="p-4 font-bold">Nama Vendor</th>
              <th className="p-4 font-bold">Kontak Person</th>
              <th className="p-4 font-bold">Telepon</th>
              <th className="p-4 font-bold">Info Rekening</th>
              <th className="p-4 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Memuat data vendor...</td></tr> : 
              vendors.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada data vendor.</td></tr> :
              vendors.map(v => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-800">{v.name}</td>
                  <td className="p-4 text-slate-600">{v.contact_person || '-'}</td>
                  <td className="p-4 text-slate-600 font-mono">{v.phone || '-'}</td>
                  <td className="p-4">
                    {v.bank_name ? (
                      <div className="text-xs">
                        <span className="font-semibold">{v.bank_name}</span> <br/>
                        <span className="font-mono text-slate-500">{v.bank_account_number}</span> <br/>
                        <span className="text-slate-500">a.n. {v.bank_account_name}</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(v)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeactivateTarget({ id: v.id, name: v.name })} className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors" title="Nonaktifkan">
                        <PowerOff className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* MODAL FORM VENDOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50 rounded-t-xl">
              <h2 className="text-lg font-bold flex items-center gap-2"><Store className="w-5 h-5 text-blue-600"/> {editingVendor ? 'Edit Vendor' : 'Tambah Vendor'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Vendor / Perusahaan *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kontak Person</label>
                  <input type="text" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. Telepon</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Alamat Kantor</label>
                <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" rows={2} />
              </div>

              <div className="border-t pt-4 mt-2">
                <h4 className="font-bold text-sm text-slate-800 mb-2">Informasi Rekening Bank</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nama Bank</label>
                    <input type="text" value={formData.bank_name} onChange={e => setFormData({...formData, bank_name: e.target.value})} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" placeholder="BCA / Mandiri" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">No. Rekening</label>
                    <input type="text" value={formData.bank_account_number} onChange={e => setFormData({...formData, bank_account_number: e.target.value})} className="w-full border rounded-md p-2 text-sm font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Atas Nama</label>
                    <input type="text" value={formData.bank_account_name} onChange={e => setFormData({...formData, bank_account_name: e.target.value})} className="w-full border rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm font-semibold hover:bg-slate-50">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold shadow-sm">Simpan Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
        title="Nonaktifkan Vendor"
        message={`Nonaktifkan vendor "${deactivateTarget?.name || ''}"? Data historis PO tetap aman.`}
        isLoading={isDeactivating}
      />
    </div>
  );
}