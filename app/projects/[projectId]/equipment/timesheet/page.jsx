'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, Loader2, CheckCircle2, AlertTriangle, FileText, CheckCircle, XCircle } from 'lucide-react';
import { saveDailyTimesheet } from '@/lib/services/equipment.service';

export default function EquipmentTimesheetPage({ params }) {
  const projectId = params.projectId;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [toast, setToast] = useState(null);

  const [equipments, setEquipments] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  
  const [formData, setFormData] = useState({
    equipment_id: '',
    log_date: new Date().toISOString().split('T')[0],
    hm_start: '',
    hm_end: '',
    standby_hours: 0,
    breakdown_hours: 0,
    work_load_type: 'Medium',
    notes: ''
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoadingData(true);
    try {
      // 1. Ambil Master Alat
      const { data: eqData } = await supabase.from('equipment_units')
        .select('id, unit_code, contract_id, equipment_categories(name)')
        .eq('project_id', projectId)
        .eq('is_active', true);
      setEquipments(eqData || []);

      // 2. Ambil Riwayat Timesheet
      const { data: tsData } = await supabase.from('equipment_timesheets')
        .select(`
          *,
          equipment_units (unit_code, equipment_categories(name))
        `)
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false });
      
      setTimesheets(tsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const workingHours = (Number(formData.hm_end) - Number(formData.hm_start)) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const selectedEq = equipments.find(eq => eq.id === formData.equipment_id);
      if (!selectedEq?.contract_id) throw new Error("Alat ini belum memiliki Kontrak Sewa.");

      await saveDailyTimesheet({
        project_id: projectId,
        equipment_id: formData.equipment_id,
        contract_id: selectedEq.contract_id,
        log_date: formData.log_date,
        hm_start: Number(formData.hm_start),
        hm_end: Number(formData.hm_end),
        standby_hours: Number(formData.standby_hours),
        breakdown_hours: Number(formData.breakdown_hours),
        work_load_type: formData.work_load_type,
        notes: formData.notes,
        status: 'Draft'
      });

      showToast('Timesheet berhasil disimpan sebagai Draft.', 'success');
      setFormData({ ...formData, hm_start: '', hm_end: '', standby_hours: 0, breakdown_hours: 0, notes: '' });
      fetchData(); // Refresh tabel history
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-start gap-3 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm">{toast.msg}</p>
        </div>
      )}

      {/* FORM INPUT TIMESHEET */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
          <Clock className="text-indigo-600" /> Form Daily Timesheet Alat
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Alat</label>
              <select required value={formData.equipment_id} onChange={e => setFormData({...formData, equipment_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
                <option value="">-- Pilih Unit Alat --</option>
                {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.unit_code} - {eq.equipment_categories?.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Log</label>
              <input type="date" required value={formData.log_date} onChange={e => setFormData({...formData, log_date: e.target.value})} className="w-full border rounded-lg p-2.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <div>
              <label className="block text-sm font-bold text-indigo-900 mb-1">HM Awal (Pagi)</label>
              <input type="number" step="0.1" required value={formData.hm_start} onChange={e => setFormData({...formData, hm_start: e.target.value})} className="w-full border rounded-lg p-2.5" placeholder="Contoh: 1200" />
            </div>
            <div>
              <label className="block text-sm font-bold text-indigo-900 mb-1">HM Akhir (Sore)</label>
              <input type="number" step="0.1" required value={formData.hm_end} onChange={e => setFormData({...formData, hm_end: e.target.value})} className="w-full border rounded-lg p-2.5" placeholder="Contoh: 1208" />
            </div>
            <div className="col-span-2 flex items-center justify-between border-t border-indigo-200 pt-2 mt-2">
              <span className="font-bold text-indigo-800">Total Jam Kerja (HM):</span>
              <span className="text-xl font-bold text-indigo-600">{workingHours.toFixed(1)} Jam</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Jam Standby (Mesin Nyala)</label>
              <input type="number" step="0.1" value={formData.standby_hours} onChange={e => setFormData({...formData, standby_hours: e.target.value})} className="w-full border rounded-lg p-2.5" />
            </div>
            <div>
              <label className="block text-sm font-bold text-red-700 mb-1">Jam Breakdown (Rusak)</label>
              <input type="number" step="0.1" value={formData.breakdown_hours} onChange={e => setFormData({...formData, breakdown_hours: e.target.value})} className="w-full border rounded-lg p-2.5 border-red-200 bg-red-50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Beban Kerja (Untuk Standar BBM)</label>
            <select value={formData.work_load_type} onChange={e => setFormData({...formData, work_load_type: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
              <option value="Low">Ringan (Grading)</option>
              <option value="Medium">Sedang (Galian Tanah)</option>
              <option value="High">Berat (Breaker / Batu)</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition-all mt-4">
            {loading ? <Loader2 className="animate-spin" /> : 'Simpan Timesheet Harian'}
          </button>
        </form>
      </div>

      {/* TABEL HISTORY TIMESHEET */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <FileText size={20} className="text-indigo-600" /> Riwayat Log Alat
            </h3>
            <p className="text-xs text-slate-500">Daftar timesheet harian yang telah diinput oleh Timekeeper.</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-semibold border-b">
              <tr>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Kode Alat</th>
                <th className="p-4 text-right">HM Awal</th>
                <th className="p-4 text-right">HM Akhir</th>
                <th className="p-4 text-right">Jam Kerja</th>
                <th className="p-4 text-right">Standby</th>
                <th className="p-4 text-right">Breakdown</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingData ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Memuat data...
                  </td>
                </tr>
              ) : timesheets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400 italic">
                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                    Belum ada riwayat timesheet yang disimpan.
                  </td>
                </tr>
              ) : (
                timesheets.map((ts, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-700">{formatDate(ts.log_date)}</td>
                    <td className="p-4 font-bold text-indigo-700">{ts.equipment_units?.unit_code}</td>
                    <td className="p-4 text-right font-mono text-slate-600">{Number(ts.hm_start).toFixed(1)}</td>
                    <td className="p-4 text-right font-mono text-slate-600">{Number(ts.hm_end).toFixed(1)}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800">{Number(ts.working_hours).toFixed(1)}</td>
                    <td className="p-4 text-right font-mono text-slate-500">{Number(ts.standby_hours).toFixed(1)}</td>
                    <td className={`p-4 text-right font-mono ${Number(ts.breakdown_hours) > 0 ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                      {Number(ts.breakdown_hours).toFixed(1)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-max mx-auto ${
                        ts.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                        ts.status === 'Invoiced' ? 'bg-blue-100 text-blue-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {ts.status === 'Approved' || ts.status === 'Invoiced' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {ts.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}