'use client';

import { useState, useEffect } from 'react';
import { Truck, Plus, X, Loader2, CheckCircle2, AlertTriangle, Edit, Trash2, Link, Droplets } from 'lucide-react';
import { getEquipmentUnits, saveEquipmentUnit, updateEquipmentUnit, softDeleteEquipmentUnit, getEquipmentCategories, getEquipmentContracts } from '@/lib/services/equipment.service';

export default function EquipmentUnitsPage({ params }) {
  const projectId = params.projectId;
  
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [contracts, setContracts] = useState([]); 
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    id: null, unit_code: '', category_id: '', initial_hm: '', initial_fuel: ''
  });

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => { fetchData(); }, [projectId]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [unitsData, catsData, contractsData] = await Promise.all([ getEquipmentUnits(projectId), getEquipmentCategories(), getEquipmentContracts(projectId) ]);
      setUnits(unitsData || []); setCategories(catsData || []); setContracts(contractsData || []);
    } catch (err) { showToast(err.message, 'error'); } finally { setLoadingData(false); }
  };

  const handleOpenModal = (unit = null) => {
    if (unit) {
      setFormData({ id: unit.id, unit_code: unit.unit_code, category_id: unit.category_id, initial_hm: unit.initial_hm, initial_fuel: unit.initial_fuel || 0 });
    } else {
      setFormData({ id: null, unit_code: '', category_id: '', initial_hm: '', initial_fuel: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category_id) return showToast("Pilih Jenis Alat terlebih dahulu!", "error");

    setLoading(true);
    try {
      const hm = Number(formData.initial_hm);
      const fuel = Number(formData.initial_fuel);
      
      if (formData.id) {
        await updateEquipmentUnit(formData.id, { unit_code: formData.unit_code, category_id: formData.category_id, initial_hm: hm, initial_fuel: fuel });
        showToast('Unit Alat berhasil diperbarui!', 'success');
      } else {
        await saveEquipmentUnit({
          project_id: projectId, unit_code: formData.unit_code, category_id: formData.category_id,
          initial_hm: hm, current_hm: hm, initial_fuel: fuel, current_fuel: fuel, is_active: true
        });
        showToast('Unit Alat berhasil didaftarkan!', 'success');
      }
      setIsModalOpen(false); fetchData();
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return; setLoading(true);
    try { await softDeleteEquipmentUnit(deleteTarget); showToast('Unit dinonaktifkan.', 'success'); fetchData(); } 
    catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); setDeleteTarget(null); }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}<p className="text-sm">{toast.msg}</p>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Truck className="text-indigo-600" /> Master Unit Alat</h1>
          <p className="text-sm text-slate-500 mt-1">Daftarkan unit fisik alat berat yang beroperasi di proyek ini.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"><Plus size={18} /> Tambah Unit</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-300">
                <th className="p-4 font-bold">Kode Unit</th>
                <th className="p-4 font-bold">Jenis Alat</th>
                <th className="p-4 font-bold text-center">Kontrak Aktif</th>
                <th className="p-4 font-bold text-right">HM Awal</th>
                <th className="p-4 font-bold text-right">HM Saat Ini</th>
                <th className="p-4 font-bold text-right">Sisa BBM (Est.)</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loadingData ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />Memuat data unit...</td></tr>
              ) : units.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-400 italic">Belum ada unit alat terdaftar.</td></tr>
              ) : (
                units.map((u) => {
                  const activeContracts = contracts.filter(c => c.category_id === u.category_id);
                  // Indikator warna BBM
                  const fuelPercent = (u.current_fuel / (u.equipment_categories?.capacity_tank_liter || 1)) * 100;
                  const fuelColor = fuelPercent < 20 ? 'text-red-600 font-bold' : fuelPercent < 50 ? 'text-amber-600 font-bold' : 'text-cyan-600 font-bold';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-indigo-700">{u.unit_code}</td>
                      <td className="p-4 text-slate-800 font-medium">{u.equipment_categories?.name || '-'}</td>
                      <td className="p-4 text-center">
                        {activeContracts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-200">
                            <Link size={12} /> {activeContracts.length} PO Tersedia
                          </span>
                        ) : (<span className="text-xs text-slate-400 italic">-</span>)}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-600">{u.initial_hm}</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-600">{u.current_hm}</td>
                      <td className={`p-4 text-right font-mono ${fuelColor}`}>
                        {u.current_fuel ? u.current_fuel.toFixed(1) : '0'} L
                        <span className="block text-[10px] text-slate-400 font-normal">Kapasitas: {u.equipment_categories?.capacity_tank_liter || 0} L</span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenModal(u)} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100"><Edit size={16} /></button>
                          <button onClick={() => setDeleteTarget(u.id)} className="text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={16} /></button>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200/60">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Truck className="w-5 h-5 text-indigo-600" /> {formData.id ? 'Edit Unit Alat' : 'Tambah Unit Alat'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-full transition-colors border border-slate-200"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kode Unit (Lambung)</label>
                  <input type="text" required value={formData.unit_code} onChange={e => setFormData({...formData, unit_code: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Contoh: EX-01, DT-05" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Jenis Alat (Kategori)</label>
                  <select required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white font-semibold">
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">HM Awal</label>
                    <input type="number" step="0.1" required value={formData.initial_hm} onChange={e => setFormData({...formData, initial_hm: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Contoh: 1500.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1"><Droplets size={14} className="text-cyan-500"/> Isi Tangki Awal</label>
                    <input type="number" step="0.1" required value={formData.initial_fuel} onChange={e => setFormData({...formData, initial_fuel: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-4 focus:ring-indigo-500/10 outline-none" placeholder="Liter" />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 mt-auto">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl">Batal</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Nonaktifkan Unit?</h3>
            <p className="text-sm text-slate-500 mb-6">Unit tidak akan dihapus permanen (Soft Delete).</p>
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