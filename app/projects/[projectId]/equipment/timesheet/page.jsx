'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, Loader2, CheckCircle2, AlertTriangle, FileText, CheckCircle, Edit, Trash2, X, Filter, AlertCircle, ThumbsUp, Droplets, Info, Calculator, Search } from 'lucide-react';
import { saveDailyTimesheet, getEquipmentContracts, getEquipmentUnits, updateTimesheet, voidTimesheet, calculateRentalBilling, approveTimesheet, getTimesheetHistory } from '@/lib/services/equipment.service';

export default function EquipmentTimesheetPage({ params }) {
  const projectId = params.projectId;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [toast, setToast] = useState(null);

  const [equipments, setEquipments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [filterEquipment, setFilterEquipment] = useState('ALL');
  const [selectedEq, setSelectedEq] = useState(null);

  // State untuk Custom Tooltip (Opsi C)
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0 });
  
  // State untuk Custom Modal Audit (Opsi B)
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditData, setAuditData] = useState(null);

  const [formData, setFormData] = useState({
    equipment_id: '', contract_id: '', log_date: new Date().toISOString().split('T')[0], hm_start: '', hm_end: '', standby_hours: 0, breakdown_hours: 0, work_load_type: 'Medium', notes: ''
  });

  const [editData, setEditData] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const eqData = await getEquipmentUnits(projectId); setEquipments(eqData || []);
      const contractData = await getEquipmentContracts(projectId); setContracts(contractData || []);
      const tsData = await getTimesheetHistory(projectId);
      setTimesheets(tsData || []);
    } catch (err) { console.error(err); } finally { setLoadingData(false); }
  };

  useEffect(() => { fetchData(); }, [projectId]);

  const handleSelectEquipment = (eqId) => {
    const eq = equipments.find(e => e.id === eqId);
    setSelectedEq(eq || null);

    let suggestedHmStart = '';
    if (eq) {
      const eqTimesheets = timesheets.filter(t => t.equipment_id === eqId);
      if (eqTimesheets.length > 0) {
        const maxHm = Math.max(...eqTimesheets.map(t => Number(t.hm_end || 0)));
        suggestedHmStart = maxHm;
      } else {
        suggestedHmStart = eq.initial_hm;
      }
    }

    setFormData(prev => ({ ...prev, equipment_id: eqId, hm_start: suggestedHmStart, hm_end: '' }));
  };

  const workingHours = Math.max(0, (Number(formData.hm_end) - Number(formData.hm_start)) || 0);
  const isHmInvalid = formData.hm_end !== '' && Number(formData.hm_end) < Number(formData.hm_start);

  const selectedContract = contracts.find(c => c.id === formData.contract_id);
  let quotaWarning = null;
  if (selectedContract) {
    const prevTs = timesheets.filter(t => t.contract_id === formData.contract_id && t.status === 'Approved');
    let usedQuota = 0;
    prevTs.forEach(t => {
      const res = calculateRentalBilling(Number(t.working_hours), Number(t.standby_hours), Number(t.breakdown_hours), selectedContract);
      usedQuota += res.quota_deduction;
    });
    const sisaKuota = selectedContract.contract_quota - usedQuota;
    
    if (sisaKuota <= 0) quotaWarning = `Kuota kontrak sudah HABIS! (Sisa: ${sisaKuota} ${selectedContract.rental_basis === 'Hourly' ? 'Jam' : 'Hari'})`;
    else if (sisaKuota < (selectedContract.rental_basis === 'Hourly' ? 10 : 2)) quotaWarning = `Sisa kuota tinggal ${sisaKuota.toFixed(1)} ${selectedContract.rental_basis === 'Hourly' ? 'Jam' : 'Hari'}! Segera perpanjang.`;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contract_id) return showToast("Pilih Kontrak Sewa (PO) terlebih dahulu!", "error");
    if (isHmInvalid) return showToast("HM Akhir tidak boleh lebih kecil dari HM Awal!", "error");
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      
      await saveDailyTimesheet({ project_id: projectId, ...formData, hm_start: Number(formData.hm_start), hm_end: Number(formData.hm_end), standby_hours: Number(formData.standby_hours), breakdown_hours: Number(formData.breakdown_hours), status: 'Draft', created_by: user.id });
      
      showToast('Timesheet berhasil disimpan. Sisa BBM telah disesuaikan.', 'success');
      setFormData({ ...formData, hm_start: '', hm_end: '', standby_hours: 0, breakdown_hours: 0, notes: '' });
      setSelectedEq(null);
      fetchData(); 
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    setLoading(true);
    try { await approveTimesheet(id); showToast('Timesheet berhasil di-Approve.', 'success'); fetchData(); } 
    catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await updateTimesheet(editData.id, { hm_start: Number(editData.hm_start), hm_end: Number(editData.hm_end), standby_hours: Number(editData.standby_hours), breakdown_hours: Number(editData.breakdown_hours), log_date: editData.log_date, notes: editData.notes });
      showToast('Timesheet diperbarui.', 'success'); setIsEditModalOpen(false); fetchData();
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const handleVoid = async () => {
    if (!voidTarget) return; setLoading(true);
    try { await voidTimesheet(voidTarget); showToast('Timesheet di-void.', 'success'); fetchData(); } 
    catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); setVoidTarget(null); }
  };

  // 🟢 PERBAIKAN: Memastikan tipe data angka aman dan menggunakan formula aljabar yang benar
  const handleOpenAudit = (ts) => {
    const balance = Number(ts.fuel_balance) || 0;
    const usage = Number(ts.fuel_usage) || 0;
    const refill = Number(ts.fuel_refill) || 0;
    
    // Rumus: Sisa Akhir = Sisa Awal + Refuel - Usage
    // Maka: Sisa Awal = Sisa Akhir - Refuel + Usage
    const initialBalance = balance - refill + usage;

    setAuditData({
      unit_code: ts.equipment_units?.unit_code || 'Unknown',
      date: ts.log_date,
      initial_balance: initialBalance,
      refuel: refill,
      usage: usage,
      final_balance: balance
    });
    setIsAuditModalOpen(true);
  };

  const filteredTimesheets = timesheets.filter(ts => filterEquipment === 'ALL' || ts.equipment_id === filterEquipment);
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const formatNumber = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(num);

  const hasNegativeFuel = filteredTimesheets.some(ts => ts.fuel_balance < 0);

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-start gap-3 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}<p className="text-sm">{toast.msg}</p>
        </div>
      )}

      {/* CUSTOM FIXED TOOLTIP (Opsi C) */}
      {tooltip.show && (
        <div 
          className="fixed z-[99999] w-64 p-3 bg-slate-800 text-white text-[11px] rounded-xl shadow-2xl text-left font-sans pointer-events-none animate-in fade-in zoom-in-95"
          style={{ top: tooltip.y, left: tooltip.x }}
        >
          <p className="font-bold text-red-400 mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Indikasi Defisit BBM</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            <li>HM (Hour Meter) error atau meloncat.</li>
            <li>Rasio konsumsi L/Jam terlalu tinggi.</li>
            <li>Pengisian fisik belum diinput ke sistem.</li>
            <li>Potensi kebocoran tangki / pencurian.</li>
          </ul>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6"><Clock className="text-indigo-600" /> Form Daily Timesheet Alat</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Alat</label>
              <select required value={formData.equipment_id} onChange={e => handleSelectEquipment(e.target.value)} className="w-full border rounded-lg p-2.5 bg-slate-50">
                <option value="">-- Pilih Unit Alat --</option>
                {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.unit_code} - {eq.equipment_categories?.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Kontrak / PO Sewa</label>
              <select required value={formData.contract_id} onChange={e => setFormData({...formData, contract_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-indigo-50 border-indigo-200">
                <option value="">-- Pilih Kontrak --</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_number} - {c.vendor_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Log</label>
              <input type="date" required value={formData.log_date} onChange={e => setFormData({...formData, log_date: e.target.value})} className="w-full border rounded-lg p-2.5" />
            </div>
          </div>

          {selectedEq && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 flex justify-between items-center animate-in fade-in">
              <div className="flex items-center gap-2 text-cyan-800 font-bold"><Droplets size={18} className="text-cyan-600" /> Estimasi Sisa BBM di Tangki Saat Ini:</div>
              <div className="font-mono font-bold text-lg text-cyan-700">{selectedEq.current_fuel?.toFixed(1) || '0'} Liter <span className="text-xs text-cyan-600 font-sans">/ {selectedEq.equipment_categories?.capacity_tank_liter || 0} L</span></div>
            </div>
          )}

          {quotaWarning && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" /><p className="text-sm font-bold">{quotaWarning}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <div>
              <label className="block text-sm font-bold text-indigo-900 mb-1">HM Awal</label>
              <input type="number" step="0.1" required value={formData.hm_start} onChange={e => setFormData({...formData, hm_start: e.target.value})} className="w-full border rounded-lg p-2.5 bg-white text-slate-600" />
              <p className="text-[10px] text-indigo-600 mt-1">*Terisi otomatis dari HM akhir Timesheet terakhir.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-indigo-900 mb-1">HM Akhir</label>
              <input type="number" step="0.1" required value={formData.hm_end} onChange={e => setFormData({...formData, hm_end: e.target.value})} className={`w-full border rounded-lg p-2.5 bg-white ${isHmInvalid ? 'border-red-500 bg-red-50' : ''}`} />
              {isHmInvalid && <p className="text-[10px] text-red-600 mt-1 font-bold">HM Akhir tidak boleh lebih kecil dari HM Awal!</p>}
            </div>
            <div className="col-span-2 flex items-center justify-between border-t border-indigo-200 pt-2 mt-2">
              <span className="font-bold text-indigo-800">Total Jam Kerja (HM):</span>
              <span className={`text-xl font-bold ${isHmInvalid ? 'text-red-600' : 'text-indigo-600'}`}>{workingHours.toFixed(1)} Jam</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-bold text-slate-700 mb-1">Jam Standby (Idle)</label><input type="number" step="0.1" value={formData.standby_hours} onChange={e => setFormData({...formData, standby_hours: e.target.value})} className="w-full border rounded-lg p-2.5" /></div>
            <div><label className="block text-sm font-bold text-red-700 mb-1">Jam Breakdown</label><input type="number" step="0.1" value={formData.breakdown_hours} onChange={e => setFormData({...formData, breakdown_hours: e.target.value})} className="w-full border rounded-lg p-2.5 border-red-200 bg-red-50" /></div>
          </div>

          <button type="submit" disabled={loading || isHmInvalid} className={`w-full text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 mt-4 ${isHmInvalid ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {loading ? <Loader2 className="animate-spin" /> : 'Simpan Timesheet'}
          </button>
        </form>
      </div>

      {!loadingData && hasNegativeFuel && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-red-800 text-sm">Peringatan Audit: Defisit BBM Terdeteksi</h4>
            <p className="text-xs text-red-700 mt-1">Sistem menemukan sisa BBM bernilai minus (merah) pada log kerja ini. Kemungkinan penyebab: HM (Hour Meter) meloncat, standar L/Jam terlalu tinggi, atau ada pengisian fisik yang belum diinput.</p>
          </div>
        </div>
      )}

      {/* TABEL RIWAYAT LOG ALAT */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><FileText size={20} className="text-indigo-600" /> Riwayat Log Alat</h3>
            <p className="text-xs text-slate-500 mt-1">Kalkulasi BBM: Sisa Sebelumnya + BBM Masuk - (Jam Kerja x Rate) - (Jam Standby x Rate Idle)</p>
          </div>
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 shadow-sm">
            <Filter size={16} className="text-slate-400" />
            <select value={filterEquipment} onChange={(e) => setFilterEquipment(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer">
              <option value="ALL">Semua Unit Alat</option>
              {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.unit_code}</option>)}
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-semibold border-b">
              <tr>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Kode Alat</th>
                <th className="p-4 text-right">Jam Kerja</th>
                <th className="p-4 text-center">Reguler</th>
                <th className="p-4 text-center">Lembur</th>
                <th className="p-4 text-right text-blue-600">BBM Masuk</th>
                <th className="p-4 text-right text-red-600">Pemakaian</th>
                <th className="p-4 text-right text-cyan-600">Sisa BBM</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingData ? (
                <tr><td colSpan={10} className="p-10 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />Memuat data...</td></tr>
              ) : filteredTimesheets.length === 0 ? (
                <tr><td colSpan={10} className="p-10 text-center text-slate-400 italic">Belum ada riwayat.</td></tr>
              ) : (
                filteredTimesheets.map((ts, idx) => {
                  const wH = Number(ts.working_hours || 0);
                  const sH = Number(ts.standby_hours || 0);
                  const bH = Number(ts.breakdown_hours || 0);
                  const cConfig = ts.equipment_contracts;
                  const res = cConfig ? calculateRentalBilling(wH, sH, bH, cConfig) : { regular_volume: 0, overtime_volume: 0, quota_deduction: 0, status_text: '-' };

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium">{formatDate(ts.log_date)}</td>
                      <td className="p-4 font-bold text-indigo-700">{ts.equipment_units?.unit_code}</td>
                      <td className="p-4 text-right font-mono font-bold">{wH.toFixed(1)} J</td>
                      <td className="p-4 text-center font-mono text-emerald-600 bg-emerald-50/30">{res.regular_volume.toFixed(1)}</td>
                      <td className="p-4 text-center font-mono text-amber-600 bg-amber-50/30">{res.overtime_volume.toFixed(1)}</td>
                      <td className="p-4 text-right font-mono font-bold text-blue-600">{ts.fuel_refill > 0 ? `${ts.fuel_refill.toFixed(0)} L` : '-'}</td>
                      <td className="p-4 text-right font-mono text-red-600">{ts.fuel_usage > 0 ? `-${ts.fuel_usage.toFixed(1)} L` : '-'}</td>
                      
                      <td 
                        className={`p-4 text-right font-mono font-bold ${ts.fuel_balance < 0 ? 'text-red-600 bg-red-50/30 cursor-help' : 'text-cyan-600 bg-cyan-50/30'}`}
                        onMouseEnter={(e) => {
                          if (ts.fuel_balance < 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ show: true, x: rect.left - 100, y: rect.bottom + 8 });
                          }
                        }}
                        onMouseLeave={() => setTooltip({ show: false, x: 0, y: 0 })}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {ts.fuel_balance < 0 && <AlertTriangle size={14} className="text-red-600 animate-pulse" />}
                          {ts.fuel_balance?.toFixed(1) || '0'} L
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${ts.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{ts.status}</span>
                      </td>
                      <td className="p-4 text-center">
                        {ts.status === 'Draft' ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleApprove(ts.id)} className="text-emerald-600 p-1.5 bg-emerald-50 rounded-lg hover:bg-emerald-100" title="Approve"><ThumbsUp size={16} /></button>
                            <button onClick={() => { setEditData({...ts}); setIsEditModalOpen(true); }} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100" title="Edit"><Edit size={16} /></button>
                            <button onClick={() => setVoidTarget(ts.id)} className="text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100" title="Void"><Trash2 size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                             {/* 🟢 TOMBOL CEK ANOMALI (Opsi B) */}
                             {ts.fuel_balance < 0 && (
                               <button onClick={() => handleOpenAudit(ts)} className="text-amber-600 p-1.5 bg-amber-50 rounded-lg hover:bg-amber-100 animate-pulse" title="Cek Anomali"><Search size={16} /></button>
                             )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🟢 CUSTOM MODAL AUDIT ANOMALI BBM (Opsi B) */}
      {isAuditModalOpen && auditData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col border border-slate-200">
            
            <div className="flex justify-between items-center px-6 py-4 border-b bg-red-600 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Calculator className="w-5 h-5" /> Audit Anomali Defisit BBM</h3>
              <button onClick={() => setIsAuditModalOpen(false)} className="text-red-200 hover:text-white bg-red-700 hover:bg-red-800 p-1.5 rounded-lg"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6 bg-slate-50">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Unit Alat</p>
                  <p className="font-bold text-lg text-indigo-700">{auditData.unit_code}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 uppercase">Tanggal</p>
                  <p className="font-semibold">{formatDate(auditData.date)}</p>
                </div>
              </div>

              {/* MATEMATIKA REKONSILIASI */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-4 font-medium text-slate-600">Sisa BBM Sebelumnya</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-800">{formatNumber(auditData.initial_balance)} L</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-medium text-blue-600">(+) BBM Masuk (Refuel)</td>
                      <td className="p-4 text-right font-mono font-bold text-blue-600">+ {formatNumber(auditData.refuel)} L</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-medium text-red-600">(-) Pemakaian Mesin (Timesheet)</td>
                      <td className="p-4 text-right font-mono font-bold text-red-600">- {formatNumber(auditData.usage)} L</td>
                    </tr>
                    <tr className="bg-red-50 border-t-2 border-red-200">
                      <td className="p-4 font-bold text-red-800 text-lg uppercase">Sisa Akhir (Fisik Sistem)</td>
                      <td className="p-4 text-right font-mono font-bold text-red-800 text-lg">{formatNumber(auditData.final_balance)} L</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* KEMUNGKINAN PENYEBAB */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertCircle size={14} className="text-red-500"/> Analisis Kemungkinan Penyebab</h4>
                <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
                  <li><b>HM (Hour Meter) Error:</b> Operator salah input HM Akhir, atau odometer mesin rusak/meloncat.</li>
                  <li><b>Rasio Konsumsi (L/Jam) Terlalu Tinggi:</b> Standar yang di-setting di sistem (misal 16 L/Jam) lebih besar dari pemakaian riil mesin.</li>
                  <li><b>Pengisian Liar / Jerigen:</b> Operator atau vendor mengisi BBM secara fisik menggunakan jerigen, namun tidak dilaporkan ke Admin untuk diinput ke sistem.</li>
                  <li><b>Kebocoran / Pencurian:</b> Terjadi kebocoran pada selang/tangki, atau BBM hilang dicuri di lokasi proyek.</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t bg-white flex justify-end">
              <button onClick={() => setIsAuditModalOpen(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Tutup & Lakukan Stock Opname</button>
            </div>
          </div>
        </div>
      )}

      {/* (MODAL EDIT & VOID TETAP SAMA SEPERTI SEBELUMNYA) */}
      {isEditModalOpen && editData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-white"><h3 className="font-bold text-lg">Edit Timesheet</h3><button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button></div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div><label className="block text-xs font-bold mb-1">Tanggal Log</label><input type="date" required value={editData.log_date} onChange={e => setEditData({...editData, log_date: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold mb-1">HM Awal</label><input type="number" step="0.1" required value={editData.hm_start} onChange={e => setEditData({...editData, hm_start: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm font-mono" /></div>
                <div><label className="block text-xs font-bold mb-1">HM Akhir</label><input type="number" step="0.1" required value={editData.hm_end} onChange={e => setEditData({...editData, hm_end: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm font-mono" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold mb-1">Jam Standby</label><input type="number" step="0.1" value={editData.standby_hours} onChange={e => setEditData({...editData, standby_hours: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm font-mono" /></div>
                <div><label className="block text-xs font-bold mb-1">Jam Breakdown</label><input type="number" step="0.1" value={editData.breakdown_hours} onChange={e => setEditData({...editData, breakdown_hours: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm font-mono" /></div>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg">{loading ? <Loader2 className="animate-spin" size={16} /> : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Batalkan Timesheet?</h3>
            <p className="text-sm text-slate-500 mb-6">Data akan di-soft delete.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setVoidTarget(null)} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl">Batal</button>
              <button onClick={handleVoid} disabled={loading} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl">Ya, Batalkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}