'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Plus, X, Loader2, CheckCircle2, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { saveVendor, updateVendor, softDeleteVendor } from '@/lib/services/equipment.service';

export default function VendorsPage({ params }) {
  const projectId = params.projectId;
  
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    id: null,
    name: '',
    contact_person: '',
    phone: '',
    address: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: ''
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchVendors = async () => {
    setLoadingData(true);
    const { data, error } = await supabase.from('vendors')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('name', { ascending: true });
      
    if (error) showToast(error.message, 'error');
    else setVendors(data || []);
    
    setLoadingData(false);
  };

  useEffect(() => {
    fetchVendors();
  }, [projectId]);

  const handleOpenModal = (vendor = null) => {
    if (vendor) {
      setFormData({
        id: vendor.id,
        name: vendor.name,
        contact_person: vendor.contact_person || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        bank_name: vendor.bank_name || '',
        bank_account_number: vendor.bank_account_number || '',
        bank_account_name: vendor.bank_account_name || ''
      });
    } else {
      setFormData({
        id: null, name: '', contact_person: '', phone: '', address: '', bank_name: '', bank_account_number: '', bank_account_name: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.id) {
        await updateVendor(formData.id, formData);
        showToast('Data Vendor berhasil diperbarui!', 'success');
      } else {
        await saveVendor({ ...formData, project_id: projectId });
        showToast('Vendor baru berhasil ditambahkan!', 'success');
      }
      setIsModalOpen(false);
      fetchVendors();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await softDeleteVendor(deleteTarget);
      showToast('Vendor berhasil dinonaktifkan.', 'success');
      fetchVendors();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-600" /> Daftar Vendor / Supplier
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data master vendor untuk keperluan PO Alat, Material, dan Subkon.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
          <Plus size={18} /> Tambah Vendor
        </button>
      </div>

      {/* TABEL VENDOR */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-300">
                <th className="p-4 font-bold">Nama Vendor</th>
                <th className="p-4 font-bold">Kontak Person</th>
                <th className="p-4 font-bold">Telepon</th>
                <th className="p-4 font-bold">Info Bank</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loadingData ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Memuat data vendor...
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400 italic">
                    Belum ada vendor terdaftar. Klik "Tambah Vendor" untuk memulai.
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{v.name}</td>
                    <td className="p-4 text-slate-600">{v.contact_person || '-'}</td>
                    <td className="p-4 text-slate-600">{v.phone || '-'}</td>
                    <td className="p-4">
                      <p className="text-xs font-bold text-slate-700">{v.bank_name || '-'}</p>
                      <p className="text-xs font-mono text-slate-500">{v.bank_account_number || '-'}</p>
                      <p className="text-xs text-slate-500">{v.bank_account_name || '-'}</p>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenModal(v)} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors" title="Edit Vendor"><Edit size={16} /></button>
                        <button onClick={() => setDeleteTarget(v.id)} className="text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors" title="Hapus Vendor"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM VENDOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200/60">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> {formData.id ? 'Edit Vendor' : 'Tambah Vendor Baru'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-full transition-colors border border-slate-200"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Perusahaan / Vendor</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-semibold" placeholder="Contoh: PT Sewa Alat Jaya" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kontak Person</label>
                    <input type="text" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Nama Bpk/Ibu" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">No. Telepon</label>
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="0812..." />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Alamat Lengkap</label>
                  <textarea rows="2" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none resize-none" placeholder="Alamat kantor..."></textarea>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-4">
                  <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">Informasi Rekening Bank</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Bank</label>
                      <input type="text" value={formData.bank_name} onChange={e => setFormData({...formData, bank_name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="BCA / Mandiri" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">No. Rekening</label>
                      <input type="text" value={formData.bank_account_number} onChange={e => setFormData({...formData, bank_account_number: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-mono" placeholder="12345678" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Atas Nama</label>
                    <input type="text" value={formData.bank_account_name} onChange={e => setFormData({...formData, bank_account_name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="PT Sewa Alat Jaya" />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 mt-auto">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 className="w-4 h-4" /> Simpan Vendor</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM MODAL (ABSOLUTE RULE #1) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Nonaktifkan Vendor?</h3>
            <p className="text-sm text-slate-500 mb-6">Data vendor tidak akan dihapus permanen (Soft Delete), namun tidak akan muncul di daftar pilihan.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Batal</button>
              <button onClick={handleDelete} disabled={loading} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex justify-center items-center">
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Ya, Nonaktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}