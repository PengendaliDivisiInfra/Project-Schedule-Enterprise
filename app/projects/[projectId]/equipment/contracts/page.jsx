'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileSignature, Plus, X, Loader2, CheckCircle2, AlertTriangle, Info, Edit, Trash2, Eye, Calendar, Truck } from 'lucide-react';
import { getEquipmentContracts, saveEquipmentContract, updateEquipmentContract, softDeleteEquipmentContract, getEquipmentCategories, getVendors, calculateRentalBilling } from '@/lib/services/equipment.service';

export default function EquipmentContractsPage({ params }) {
  const projectId = params.projectId;
  
  const [contracts, setContracts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allTimesheets, setAllTimesheets] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [viewData, setViewData] = useState(null);
  const [viewUnits, setViewUnits] = useState([]); 
  const [loadingViewUnits, setLoadingViewUnits] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const initialFormState = {
    id: null, contract_number: '', vendor_name: '', category_id: '', 
    rental_basis: 'Hourly', contract_quota: 100, daily_normal_hours_limit: 8, overtime_deducts_quota: false,
    rate_per_hour: '', overtime_rate: '', mob_demob_cost: 0, fuel_deduction_policy: 'Vendor',
    start_date: new Date().toISOString().split('T')[0], end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    is_active: true
  };

  const [formData, setFormData] = useState(initialFormState);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchInitialData();
  }, [projectId]);

  const fetchInitialData = async () => {
    setLoadingData(true);
    try {
      const [contractsData, vendorsData, categoriesData, tsData] = await Promise.all([ 
        getEquipmentContracts(projectId), 
        getVendors(projectId), 
        getEquipmentCategories(),
        supabase.from('equipment_timesheets').select('contract_id, working_hours, standby_hours, breakdown_hours').eq('project_id', projectId).eq('is_deleted', false).eq('status', 'Approved')
      ]);
      setContracts(contractsData || []); 
      setVendors(vendorsData || []); 
      setCategories(categoriesData || []);
      setAllTimesheets(tsData.data || []);
    } catch (err) { showToast(err.message, 'error'); } finally { setLoadingData(false); }
  };

  const handleOpenDetail = async (contract) => {
    setViewData(contract);
    setLoadingViewUnits(true);
    
    try {
      // 🟢 PERBAIKAN: Menggunakan !inner agar memastikan relasi approved terbaca
      const { data: tsData, error } = await supabase
        .from('equipment_timesheets')
        .select(`log_date, hm_start, hm_end, equipment_units!inner(unit_code, equipment_categories(name))`)
        .eq('contract_id', contract.id)
        .eq('is_deleted', false)
        .eq('status', 'Approved')
        .order('log_date', { ascending: true });

      if (error) throw error;

      const unitMap = new Map();
      (tsData || []).forEach(ts => {
        const uCode = ts.equipment_units?.unit_code || 'Unknown';
        const uName = ts.equipment_units?.equipment_categories?.name || '-';
        
        if (!unitMap.has(uCode)) {
          unitMap.set(uCode, { unit_code: uCode, category_name: uName, first_hm: ts.hm_start, last_hm: ts.hm_end, first_date: ts.log_date, last_date: ts.log_date });
        } else {
          const existing = unitMap.get(uCode);
          existing.last_hm = ts.hm_end;
          existing.last_date = ts.log_date;
        }
      });
      
      setViewUnits(Array.from(unitMap.values()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingViewUnits(false);
    }
  };

  const handleOpenModal = (contract = null) => {
    if (contract) setFormData({ ...contract });
    else setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vendor_name) return showToast("Pilih Vendor!", "error");
    if (!formData.category_id) return showToast("Pilih Jenis Alat!", "error");
    
    setLoading(true);
    try {
      const payload = {
        contract_number: formData.contract_number,
        vendor_name: formData.vendor_name,
        category_id: formData.category_id,
        rental_basis: formData.rental_basis,
        contract_quota: Number(formData.contract_quota || 0),
        daily_normal_hours_limit: Number(formData.daily_normal_hours_limit || 8),
        overtime_deducts_quota: formData.overtime_deducts_quota,
        rate_per_hour: Number(formData.rate_per_hour),
        overtime_rate: Number(formData.overtime_rate || 0),
        mob_demob_cost: Number(formData.mob_demob_cost || 0),
        fuel_deduction_policy: formData.fuel_deduction_policy,
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_active: formData.is_active
      };

      if (formData.id) { await updateEquipmentContract(formData.id, payload); showToast('Kontrak diperbarui!', 'success'); } 
      else { await saveEquipmentContract({ ...payload, project_id: projectId }); showToast('Kontrak dibuat!', 'success'); }
      
      setIsModalOpen(false); fetchInitialData();
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await softDeleteEquipmentContract(deleteTarget);
      showToast('Kontrak dinonaktifkan.', 'success'); fetchInitialData();
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); setDeleteTarget(null); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

  return (
    <div className="space-y-6 animate-in fade-in relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileSignature className="text-indigo-600" /> Kontrak Sewa Alat (PO)</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola master kontrak, tarif, kuota, dan aturan lembur.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"><Plus size={18} /> Buat Kontrak</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-300">
                <th className="p-4 font-bold">No. Kontrak</th>
                <th className="p-4 font-bold">Vendor / Alat</th>
                <th className="p-4 font-bold text-center">Basis Sewa</th>
                <th className="p-4 font-bold text-center">Sisa Kuota</th>
                <th className="p-4 font-bold text-center">Status PO</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loadingData ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />Memuat kontrak...</td></tr>
              ) : contracts.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">Belum ada kontrak.</td></tr>
              ) : (
                contracts.map((c) => {
                  const relatedTs = allTimesheets.filter(ts => ts.contract_id === c.id);
                  let usedQuota = 0;
                  relatedTs.forEach(ts => {
                    const res = calculateRentalBilling(Number(ts.working_hours || 0), Number(ts.standby_hours || 0), Number(ts.breakdown_hours || 0), c);
                    usedQuota += res.quota_deduction;
                  });
                  const sisaKuota = c.contract_quota - usedQuota;
                  const percentageUsed = Math.min(100, (usedQuota / c.contract_quota) * 100);

                  const today = new Date();
                  const start = new Date(c.start_date);
                  const end = new Date(c.end_date);
                  let statusBadge = null;

                  if (sisaKuota <= 0) {
                    statusBadge = <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">Quota Exhausted</span>;
                  } else if (start > today) {
                    statusBadge = <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">Upcoming</span>;
                  } else if (end < today) {
                    statusBadge = <span className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-600 border border-slate-300">Expired (Waktu)</span>;
                  } else {
                    statusBadge = <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>;
                  }

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-indigo-700">{c.contract_number}</td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-800">{c.vendor_name}</p>
                        <p className="text-xs text-slate-500">{c.equipment_categories?.name || '-'}</p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">{c.rental_basis}</span>
                      </td>
                      <td className="p-4">
                        <div className="w-full flex flex-col items-center">
                          <div className="flex justify-between w-full text-[10px] font-bold text-slate-500 mb-1">
                            <span>Terpakai: {usedQuota.toFixed(1)}</span>
                            <span>Sisa: {sisaKuota.toFixed(1)}</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${sisaKuota <= 0 ? 'bg-red-500' : percentageUsed > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${percentageUsed}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1">Total Kuota: {c.contract_quota} {c.rental_basis === 'Hourly' ? 'Jam' : 'Hari'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {statusBadge}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenDetail(c)} className="text-emerald-600 p-1.5 bg-emerald-50 rounded-lg hover:bg-emerald-100" title="Lihat Detail"><Eye size={16} /></button>
                          <button onClick={() => handleOpenModal(c)} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100" title="Edit"><Edit size={16} /></button>
                          <button onClick={() => setDeleteTarget(c.id)} className="text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100" title="Nonaktifkan"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETAIL KONTRAK (DENGAN TARIF LENGKAP) */}
      {viewData && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 flex flex-col border border-slate-200">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-800 text-white">
              <h2 className="text-lg font-bold flex items-center gap-2"><FileSignature className="w-5 h-5" /> Detail Kontrak: {viewData.contract_number}</h2>
              <button onClick={() => setViewData(null)} className="text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 p-1.5 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar space-y-6">
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border">
                <div className="space-y-4">
                  <div><p className="text-xs font-bold text-slate-500 uppercase">Vendor</p><p className="font-semibold text-lg">{viewData.vendor_name}</p></div>
                  <div><p className="text-xs font-bold text-slate-500 uppercase">Jenis Alat</p><p className="font-semibold text-lg">{viewData.equipment_categories?.name || '-'}</p></div>
                  <div><p className="text-xs font-bold text-slate-500 uppercase">Periode Kontrak</p><p className="font-semibold text-sm flex items-center gap-2"><Calendar size={16}/> {formatDate(viewData.start_date)} s/d {formatDate(viewData.end_date)}</p></div>
                </div>
                <div className="space-y-4 bg-white p-4 rounded-xl border shadow-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs font-bold text-slate-500 uppercase">Tarif Reguler</p><p className="font-mono font-bold text-indigo-700">{formatCurrency(viewData.rate_per_hour)}</p></div>
                    <div><p className="text-xs font-bold text-slate-500 uppercase">Tarif Lembur / Jam</p><p className="font-mono font-bold text-amber-600">{formatCurrency(viewData.overtime_rate)}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs font-bold text-slate-500 uppercase">Basis Sewa</p><p className="font-bold text-blue-600">{viewData.rental_basis}</p></div>
                    <div><p className="text-xs font-bold text-slate-500 uppercase">Batas Normal / Hari</p><p className="font-mono font-bold">{viewData.daily_normal_hours_limit} Jam</p></div>
                  </div>
                  <div><p className="text-xs font-bold text-slate-500 uppercase">Total Kuota</p><p className="font-mono font-bold text-lg">{viewData.contract_quota} {viewData.rental_basis === 'Hourly' ? 'Jam' : 'Hari'}</p></div>
                  <div><p className="text-xs font-bold text-slate-500 uppercase">Aturan Lembur</p><p className={`font-bold ${viewData.overtime_deducts_quota ? 'text-red-600' : 'text-emerald-600'}`}>{viewData.overtime_deducts_quota ? 'Memotong Kuota' : 'Tidak Memotong (Terpisah)'}</p></div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-3"><Truck className="text-indigo-600" size={20}/> Unit Alat yang Bekerja di PO Ini (Approved)</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                      <tr>
                        <th className="p-3">Kode Unit</th>
                        <th className="p-3">Jenis</th>
                        <th className="p-3 text-center">HM Awal (Log Pertama)</th>
                        <th className="p-3 text-center">HM Akhir (Log Terakhir)</th>
                        <th className="p-3 text-right">Total Jam Kerja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingViewUnits ? (
                        <tr><td colSpan={5} className="p-6 text-center text-slate-400"><Loader2 size={20} className="animate-spin mx-auto" /></td></tr>
                      ) : viewUnits.length === 0 ? (
                        <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">Belum ada unit yang di-approve untuk kontrak ini.</td></tr>
                      ) : (
                        viewUnits.map((u, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-indigo-700">{u.unit_code}</td>
                            <td className="p-3 text-slate-600">{u.category_name}</td>
                            <td className="p-3 text-center font-mono text-slate-500">{u.first_hm}</td>
                            <td className="p-3 text-center font-mono text-emerald-600 font-bold">{u.last_hm}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-600">{u.last_hm - u.first_hm} Jam</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">*Data ditarik secara otomatis dari input Timesheet yang sudah di-Approved.</p>
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end bg-slate-50">
              <button onClick={() => setViewData(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM EDIT/TAMBAH KONTRAK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200/60">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileSignature className="w-5 h-5 text-indigo-600" /> {formData.id ? 'Edit Kontrak' : 'Form Kontrak Sewa'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">No. Kontrak / PO</label>
                    <input type="text" required value={formData.contract_number} onChange={e => setFormData({...formData, contract_number: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm font-semibold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Nama Vendor</label>
                    <select required value={formData.vendor_name} onChange={e => setFormData({...formData, vendor_name: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm font-semibold bg-white">
                      <option value="">-- Pilih Vendor --</option>
                      {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Jenis Alat</label>
                    <select required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm font-semibold bg-white">
                      <option value="">-- Pilih Jenis Alat --</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Tgl Mulai</label>
                      <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full px-2 py-2.5 border rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Tgl Selesai</label>
                      <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full px-2 py-2.5 border rounded-xl text-xs" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Basis Sewa</label>
                    <select value={formData.rental_basis} onChange={e => setFormData({...formData, rental_basis: e.target.value})} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm font-bold bg-white">
                      <option value="Hourly">Per Jam (Hourly)</option>
                      <option value="Daily">Per Hari (Daily)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Total Kuota</label>
                    <input type="number" required value={formData.contract_quota} onChange={e => setFormData({...formData, contract_quota: e.target.value})} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm font-mono font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Batas Normal/Hari</label>
                    <input type="number" required value={formData.daily_normal_hours_limit} onChange={e => setFormData({...formData, daily_normal_hours_limit: e.target.value})} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm font-mono font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1.5">Lembur Potong Kuota?</label>
                    <select value={formData.overtime_deducts_quota ? 'true' : 'false'} onChange={e => setFormData({...formData, overtime_deducts_quota: e.target.value === 'true'})} className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl text-sm font-bold bg-white">
                      <option value="false">Tidak (Terpisah)</option>
                      <option value="true">Ya (Memotong)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Tarif Normal / {formData.rental_basis === 'Hourly' ? 'Jam' : 'Hari'}</label>
                    <input type="number" required value={formData.rate_per_hour} onChange={e => setFormData({...formData, rate_per_hour: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Tarif Lembur / Jam</label>
                    <input type="number" required value={formData.overtime_rate} onChange={e => setFormData({...formData, overtime_rate: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Mob/Demob Cost</label>
                    <input type="number" value={formData.mob_demob_cost} onChange={e => setFormData({...formData, mob_demob_cost: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl text-sm font-mono" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    Kebijakan BBM <Info size={14} className="text-slate-400" />
                  </label>
                  <select value={formData.fuel_deduction_policy} onChange={e => setFormData({...formData, fuel_deduction_policy: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white font-semibold">
                    <option value="Vendor">Vendor (Potong Tagihan)</option>
                    <option value="Client">Client (Kita yang tanggung)</option>
                  </select>
                </div>

              </div>

              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3 mt-auto">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border rounded-xl">Batal</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 className="w-4 h-4" /> Simpan Kontrak</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DELETE */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Nonaktifkan Kontrak?</h3>
            <p className="text-sm text-slate-500 mb-6">Data tidak akan dihapus permanen (Soft Delete).</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl">Batal</button>
              <button onClick={handleDelete} disabled={loading} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl">Ya, Nonaktifkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}