'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Fuel, AlertTriangle, CheckCircle2, Loader2, Gauge, Droplets, Info } from 'lucide-react';
import { processFuelTransaction, getDynamicRate } from '@/lib/services/equipment.service';

export default function FuelManagementPage({ params }) {
  const projectId = params.projectId;
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [tanks, setTanks] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentStandardRate, setCurrentStandardRate] = useState(0);

  const [formData, setFormData] = useState({
    tank_id: '',
    equipment_id: '',
    quantity_liter: '',
    hm_recorded: '',
    work_load_type: 'Medium'
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: tankData } = await supabase.from('fuel_tanks').select('*').eq('project_id', projectId);
      const { data: eqData } = await supabase.from('equipment_units')
        .select('*, equipment_categories(name, capacity_tank_liter, rate_low, rate_medium, rate_high, rate_idle)')
        .eq('project_id', projectId)
        .eq('is_active', true);
      
      setTanks(tankData || []);
      setEquipments(eqData || []);
    };
    fetchData();
  }, [projectId]);

  useEffect(() => {
    if (formData.equipment_id) {
      const selectedEq = equipments.find(e => e.id === formData.equipment_id);
      if (selectedEq && selectedEq.equipment_categories) {
        setSelectedCategory(selectedEq.equipment_categories);
        const rate = getDynamicRate(selectedEq.equipment_categories, formData.work_load_type);
        setCurrentStandardRate(rate);
      }
    } else {
      setSelectedCategory(null);
      setCurrentStandardRate(0);
    }
  }, [formData.equipment_id, formData.work_load_type, equipments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await processFuelTransaction({
        project_id: projectId,
        tank_id: formData.tank_id,
        equipment_id: formData.equipment_id,
        transaction_type: 'OUT',
        quantity_liter: Number(formData.quantity_liter),
        hm_recorded: Number(formData.hm_recorded),
        work_load_type: formData.work_load_type,
        created_by: 'user-id-placeholder' 
      });

      if (res.isAnomaly) {
        showToast(res.anomalyReason, 'error'); 
      } else {
        showToast(res.message, 'success');
      }
      
      setFormData({ ...formData, quantity_liter: '', hm_recorded: '' });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-start gap-3 max-w-md ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} className="shrink-0" /> : <AlertTriangle size={24} className="shrink-0 animate-pulse" />}
          <p className="text-sm leading-relaxed">{toast.msg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI: FORM INPUT */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
            <Fuel className="text-indigo-600" /> Form Pengisian BBM
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Tangki Induk</label>
              <select required value={formData.tank_id} onChange={e => setFormData({...formData, tank_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
                <option value="">-- Pilih Tangki --</option>
                {tanks.map(t => <option key={t.id} value={t.id}>{t.tank_name} (Sisa: {t.current_stock_liter} L)</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Alat Sewa</label>
              <select required value={formData.equipment_id} onChange={e => setFormData({...formData, equipment_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
                <option value="">-- Pilih Unit --</option>
                {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.unit_code} - {eq.equipment_categories?.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Hour Meter (HM) Saat Ini</label>
                <input type="number" step="0.1" required value={formData.hm_recorded} onChange={e => setFormData({...formData, hm_recorded: e.target.value})} className="w-full border rounded-lg p-2.5" placeholder="Contoh: 1250.5" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Jumlah Liter Diisi</label>
                <input type="number" required value={formData.quantity_liter} onChange={e => setFormData({...formData, quantity_liter: e.target.value})} className="w-full border rounded-lg p-2.5" placeholder="Contoh: 150" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Beban Kerja Hari Ini</label>
              <select value={formData.work_load_type} onChange={e => setFormData({...formData, work_load_type: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
                <option value="Low">Ringan (Grading / Idling)</option>
                <option value="Medium">Sedang (Galian Tanah Biasa)</option>
                <option value="High">Berat (Breaker / Batu / Tanjakan)</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition-all mt-4">
              {loading ? <Loader2 className="animate-spin" /> : 'Simpan Pengisian BBM'}
            </button>
          </form>
        </div>

        {/* KOLOM KANAN: SMART INFO BOX */}
        <div className="md:col-span-1">
          <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg sticky top-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4 border-b border-slate-600 pb-3">
              <Gauge size={20} className="text-emerald-400" /> Standar Operasional
            </h3>
            
            {selectedCategory ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Kategori Alat</p>
                  <p className="text-lg font-semibold">{selectedCategory.name}</p>
                </div>
                
                <div className="bg-slate-700 p-3 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><Droplets size={14}/> Kapasitas Tangki</p>
                  <p className="text-xl font-mono font-bold text-blue-300">{selectedCategory.capacity_tank_liter} Liter</p>
                </div>

                <div className="bg-slate-700 p-3 rounded-lg border-l-4 border-emerald-400">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Standar Konsumsi (L/Jam)</p>
                  <p className="text-3xl font-mono font-bold text-emerald-400">{currentStandardRate.toFixed(1)}</p>
                  <p className="text-xs text-slate-300 mt-1">Beban: <span className="font-bold text-white">{formData.work_load_type}</span></p>
                </div>

                <div className="text-xs text-slate-400 flex items-start gap-2 mt-4">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <p>Sistem akan menolak input jika rasio melebihi 20% dari standar ini untuk mencegah kecurangan BBM.</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 opacity-50">
                <Gauge size={48} className="mx-auto mb-3" />
                <p className="text-sm">Pilih Alat & Beban Kerja untuk melihat standar konsumsi.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}