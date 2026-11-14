'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Fuel, AlertTriangle, CheckCircle2, Loader2, Gauge, Droplets, Info, Settings, X, Edit, Trash2, FileText, Filter, AlertCircle, Calculator, Search, ShoppingCart } from 'lucide-react';
import { processFuelTransaction, getDynamicRate, getEquipmentUnits, updateUnitFuelRates, getFuelHistory, updateFuelTransaction, voidFuelTransaction, getEquipmentCategories, receiveFuelPO, getFuelPOs } from '@/lib/services/equipment.service';
import { recordFuelDispensing } from '@/lib/services/inventory-service'; // IMPORT FUNGSI BUKU BESAR

export default function FuelManagementPage({ params }) {
  const projectId = params.projectId;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [toast, setToast] = useState(null);

  const [tanks, setTanks] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [categories, setCategories] = useState([]); 
  const [history, setHistory] = useState([]);
  const [openPOs, setOpenPOs] = useState([]); // STATE BARU UNTUK LIST PO
  
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [selectedEq, setSelectedEq] = useState(null);
  const [currentStandardRate, setCurrentStandardRate] = useState(0);
  
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [rateForm, setRateForm] = useState({ low: '', medium: '', high: '' });

  const [editData, setEditData] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);

  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0 });
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditData, setAuditData] = useState(null);

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveData, setReceiveData] = useState({ po_id: '', actual_volume: '' });

  // STATE FORM: Menambahkan po_id
  const [formData, setFormData] = useState({
    tank_id: '', equipment_id: '', po_id: '', quantity_liter: '', hm_recorded: '', work_load_type: 'Medium', transaction_date: new Date().toISOString().split('T')[0]
  });

  const showToast = (msg, type = 'success') => { 
    setToast({ msg, type }); 
    setTimeout(() => setToast(null), 5000); 
  };

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const { data: tankData } = await supabase.from('fuel_tanks').select('*').eq('project_id', projectId);
      const eqData = await getEquipmentUnits(projectId);
      const histData = await getFuelHistory(projectId);
      const catData = await getEquipmentCategories();
      const poData = await getFuelPOs(projectId);
      
      setTanks(tankData || []);
      setEquipments(eqData || []);
      setHistory(histData);
      setCategories(catData || []);
      setOpenPOs((poData || []).filter(p => p.status === 'Open'));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { fetchData(); }, [projectId]);

  useEffect(() => {
    if (formData.equipment_id && equipments.length > 0) {
      const eq = equipments.find(e => e.id === formData.equipment_id);
      if (eq) {
        setSelectedEq(eq);
        const rate = getDynamicRate(eq, formData.work_load_type);
        setCurrentStandardRate(rate);
      }
    } else {
      setSelectedEq(null);
      setCurrentStandardRate(0);
    }
  }, [formData.equipment_id, formData.work_load_type, equipments]);

  const filteredHistory = history.filter((trx) => {
    if (filterCategory === 'ALL') return true;
    return trx.equipment_units?.category_id === filterCategory;
  });

  const hasNegativeFuel = filteredHistory.some(trx => trx.fuel_balance < 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login tidak ditemukan.");

      // 1. Simpan ke tabel fuel_transactions (Sistem BBM Alat)
      const res = await processFuelTransaction({
        project_id: projectId, 
        ...formData, 
        quantity_liter: Number(formData.quantity_liter), 
        hm_recorded: Number(formData.hm_recorded),
        transaction_type: 'OUT', 
        created_by: user.id
      });

      // 2. TARIK KE BUKU BESAR GUDANG (Auto-Cost & Ledger)
      const selectedEquipment = equipments.find(eq => eq.id === formData.equipment_id);
      if (selectedEquipment) {
        await recordFuelDispensing(
          projectId, 
          res.fuel_hsd_id || '', // Pastikan processFuelTransaction mengembalikan ID Solar, atau kita cari manual
          Number(formData.quantity_liter), 
          formData.equipment_id, 
          selectedEquipment.unit_code, 
          Number(formData.hm_recorded), 
          formData.po_id || 'Tanpa PO'
        );
      }

      if (res.isAnomaly) showToast(res.anomalyReason, 'error'); 
      else showToast(res.message, 'success');
      
      setFormData({ ...formData, quantity_liter: '', hm_recorded: '', po_id: '' });
      fetchData(); 
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveFuel = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login berakhir.");
      
      await receiveFuelPO(receiveData.po_id, Number(receiveData.actual_volume), user.id);
      
      showToast('Penerimaan BBM sukses & Kas Keluar tercatat.', 'success');
      setIsReceiveModalOpen(false);
      setReceiveData({ po_id: '', actual_volume: '' });
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRateModal = () => {
    if (!selectedEq) return;
    setRateForm({
      low: selectedEq.custom_rate_low || selectedEq.equipment_categories?.rate_low || '',
      medium: selectedEq.custom_rate_medium || selectedEq.equipment_categories?.rate_medium || '',
      high: selectedEq.custom_rate_high || selectedEq.equipment_categories?.rate_high || ''
    });
    setIsRateModalOpen(true);
  };

  const handleSaveRates = async (e) => {
    e.preventDefault(); 
    setLoading(true);
    try {
      await updateUnitFuelRates(selectedEq.id, {
        custom_rate_low: rateForm.low ? Number(rateForm.low) : null,
        custom_rate_medium: rateForm.medium ? Number(rateForm.medium) : null,
        custom_rate_high: rateForm.high ? Number(rateForm.high) : null,
      });
      showToast('Standar konsumsi berhasil diperbarui!', 'success');
      setIsRateModalOpen(false);
      await fetchData();
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const handleOpenEdit = (trx) => { 
    setEditData({ ...trx }); 
    setIsEditModalOpen(true); 
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault(); 
    setLoading(true);
    try {
      const oldTrx = history.find(h => h.id === editData.id);
      await updateFuelTransaction(editData.id, {
        quantity_liter: Number(editData.quantity_liter), 
        hm_recorded: Number(editData.hm_recorded),
        work_load_type: editData.work_load_type, 
        transaction_date: editData.transaction_date,
        is_anomaly: false, 
        anomaly_reason: null
      }, oldTrx.quantity_liter, oldTrx.tank_id);
      
      showToast('Riwayat BBM berhasil diperbarui.', 'success'); 
      setIsEditModalOpen(false); 
      fetchData();
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const handleVoid = async () => {
    if (!voidTarget) return; 
    setLoading(true);
    try {
      await voidFuelTransaction(voidTarget.id, voidTarget.tank_id, voidTarget.quantity_liter);
      showToast('Transaksi BBM dibatalkan, stok tangki telah dikembalikan.', 'success'); 
      fetchData();
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); setVoidTarget(null); }
  };

  const handleOpenAudit = async (trx) => {
    setLoading(true);
    try {
      const { data: tsData } = await supabase.from('equipment_timesheets')
        .select('working_hours, standby_hours, work_load_type')
        .eq('equipment_id', trx.equipment_id)
        .eq('log_date', trx.transaction_date)
        .eq('is_deleted', false)
        .maybeSingle();

      let usage = 0;
      if (tsData) {
        const wH = Number(tsData.working_hours || 0);
        const sH = Number(tsData.standby_hours || 0);
        const workLoad = tsData.work_load_type || 'Medium';
        const eqCat = trx.equipment_units?.equipment_categories;
        
        let rateWork = eqCat?.rate_medium || 10;
        if (workLoad === 'Low') rateWork = eqCat?.rate_low || 8;
        if (workLoad === 'High') rateWork = eqCat?.rate_high || 15;
        const rateIdle = eqCat?.rate_idle || 4;

        usage = (wH * rateWork) + (sH * rateIdle);
      }

      const balance = Number(trx.fuel_balance) || 0;
      const refill = Number(trx.quantity_liter) || 0;
      
      const initialBalance = balance - refill + usage;

      setAuditData({
        unit_code: trx.equipment_units?.unit_code || 'Unknown',
        date: trx.transaction_date,
        initial_balance: initialBalance,
        refuel: refill,
        usage: usage,
        final_balance: balance
      });
      setIsAuditModalOpen(true);
    } catch (err) {
      showToast("Gagal memuat detail audit", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const formatNumber = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(num);

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-start gap-3 max-w-md ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} className="shrink-0" /> : <AlertTriangle size={24} className="shrink-0 animate-pulse" />}
          <p className="text-sm leading-relaxed">{toast.msg}</p>
        </div>
      )}

      {tooltip.show && (
        <div className="fixed z-[99999] w-64 p-3 bg-slate-800 text-white text-[11px] rounded-xl shadow-2xl text-left font-sans pointer-events-none animate-in fade-in zoom-in-95" style={{ top: tooltip.y, left: tooltip.x }}>
          <p className="font-bold text-red-400 mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Indikasi Defisit BBM</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            <li>Pengisian fisik (jerigen) belum diinput.</li>
            <li>Kebocoran tangki atau pencurian.</li>
            <li>Rasio L/Jam terlalu tinggi dari aktual.</li>
          </ul>
        </div>
      )}

      {tanks.map(t => {
        if (t.current_stock_liter <= (t.reorder_point_liter || 1000)) {
          return (
            <div key={t.id} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3 mb-4 animate-in fade-in">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-red-800 text-sm">Peringatan Stok Rendah: {t.tank_name}</h4>
                <p className="text-xs text-red-700 mt-1">Sisa stok saat ini {t.current_stock_liter} L. Segera buat PO BBM baru di tab Pengadaan BBM untuk mencegah operasional terhenti.</p>
              </div>
            </div>
          );
        }
        return null;
      })}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Fuel className="text-indigo-600" /> Form Pengisian BBM</h1>
            <button onClick={() => setIsReceiveModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md">
              <ShoppingCart size={16} /> Terima BBM (PO)
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Tangki Induk</label>
                <select required value={formData.tank_id} onChange={e => setFormData({...formData, tank_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
                  <option value="">-- Pilih Tangki --</option>
                  {tanks.map(t => <option key={t.id} value={t.id}>{t.tank_name} (Sisa: {t.current_stock_liter} L)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Pengisian</label>
                <input type="date" required value={formData.transaction_date} onChange={e => setFormData({...formData, transaction_date: e.target.value})} className="w-full border rounded-lg p-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Alat Sewa</label>
                <select required value={formData.equipment_id} onChange={e => setFormData({...formData, equipment_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
                  <option value="">-- Pilih Unit --</option>
                  {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.unit_code} - {eq.equipment_categories?.name}</option>)}
                </select>
              </div>
              <div>
                {/* DROPDOWN PO BBM BARU */}
                <label className="block text-sm font-bold text-slate-700 mb-1">Referensi PO BBM</label>
                <select value={formData.po_id} onChange={e => setFormData({...formData, po_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
                  <option value="">-- Tanpa PO / Stok Awal --</option>
                  {openPOs.map(po => <option key={po.id} value={po.id}>{po.po_number} ({po.total_volume} L)</option>)}
                </select>
              </div>
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
              {loading ? <Loader2 className="animate-spin" /> : 'Simpan Pengisian BBM ke Alat'}
            </button>
          </form>
        </div>

        <div className="md:col-span-1">
          <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg sticky top-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4 border-b border-slate-600 pb-3"><Gauge size={20} className="text-emerald-400" /> Standar Operasional</h3>
            {selectedEq ? (
              <div className="space-y-4">
                <div><p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Kategori Alat</p><p className="text-lg font-semibold">{selectedEq.equipment_categories?.name}</p></div>
                <div className="bg-slate-700 p-3 rounded-lg"><p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><Droplets size={14}/> Kapasitas Tangki</p><p className="text-xl font-mono font-bold text-blue-300">{selectedEq.equipment_categories?.capacity_tank_liter} Liter</p></div>
                <div className="bg-slate-700 p-3 rounded-lg border-l-4 border-emerald-400 relative">
                  <button type="button" onClick={handleOpenRateModal} className="absolute top-2 right-2 p-1.5 bg-slate-600 rounded-md hover:bg-slate-500 text-white" title="Ubah Standar"><Settings size={14} /></button>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Standar Konsumsi (L/Jam)</p>
                  <p className="text-3xl font-mono font-bold text-emerald-400">{currentStandardRate.toFixed(1)}</p>
                  <p className="text-xs text-slate-300 mt-1">Beban: <span className="font-bold text-white">{formData.work_load_type}</span></p>
                </div>
                <div className="text-xs text-slate-400 flex items-start gap-2 mt-4"><Info size={16} className="shrink-0 mt-0.5" /><p>Sistem akan menolak input jika rasio melebihi 20% dari standar ini untuk mencegah kecurangan BBM.</p></div>
              </div>
            ) : (
              <div className="text-center py-10 opacity-50"><Gauge size={48} className="mx-auto mb-3" /><p className="text-sm">Pilih Alat & Beban Kerja untuk melihat standar konsumsi.</p></div>
            )}
          </div>
        </div>
      </div>

      {!loadingData && hasNegativeFuel && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3 animate-in fade-in mt-6">
          <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-red-800 text-sm">Peringatan Audit: Defisit BBM Terdeteksi</h4>
            <p className="text-xs text-red-700 mt-1">Sistem menemukan sisa BBM bernilai minus (merah). Hal ini dapat disebabkan oleh pengisian BBM via jerigen yang belum dicatat, kebocoran tangki, atau selisih stok awal. Segera lakukan stock opname (sounding) manual.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><FileText size={20} className="text-indigo-600" /> Riwayat Pengisian BBM</h3></div>
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-sm">
            <Filter size={16} className="text-slate-400" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer">
              <option value="ALL">Semua Jenis Alat</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-semibold border-b">
              <tr>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Alat</th>
                <th className="p-4">Tangki</th>
                <th className="p-4 text-right">HM</th>
                <th className="p-4 text-right">Liter</th>
                <th className="p-4 text-right text-cyan-600">Sisa BBM Alat</th>
                <th className="p-4 text-center">Beban</th>
                <th className="p-4 text-center">Anomali</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingData ? (
                <tr><td colSpan={9} className="p-10 text-center text-slate-400"><Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />Memuat data...</td></tr>
              ) : filteredHistory.length === 0 ? (
                <tr><td colSpan={9} className="p-10 text-center text-slate-400 italic">Tidak ada riwayat pengisian BBM untuk filter ini.</td></tr>
              ) : (
                filteredHistory.map((trx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-700">{formatDate(trx.transaction_date)}</td>
                    <td className="p-4 font-bold text-indigo-700">{trx.equipment_units?.unit_code}</td>
                    <td className="p-4 text-slate-600">{trx.fuel_tanks?.tank_name}</td>
                    <td className="p-4 text-right font-mono text-slate-600">{Number(trx.hm_recorded).toFixed(1)}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800">{Number(trx.quantity_liter).toFixed(0)} L</td>
                    <td 
                      className={`p-4 text-right font-mono font-bold ${trx.fuel_balance < 0 ? 'text-red-600 bg-red-50/30 cursor-help' : 'text-cyan-600 bg-cyan-50/30'}`}
                      onMouseEnter={(e) => {
                        if (trx.fuel_balance < 0) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ show: true, x: rect.left - 100, y: rect.bottom + 8 });
                        }
                      }}
                      onMouseLeave={() => setTooltip({ show: false, x: 0, y: 0 })}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {trx.fuel_balance < 0 && <AlertTriangle size={14} className="text-red-600 animate-pulse" />}
                        {trx.fuel_balance?.toFixed(1) || '0'} L
                      </div>
                    </td>
                    <td className="p-4 text-center"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{trx.work_load_type}</span></td>
                    <td className="p-4 text-center">
                      {trx.is_anomaly ? (<span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200" title={trx.anomaly_reason}>YA</span>) : (<span className="text-emerald-500 text-xs font-bold">Aman</span>)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {trx.fuel_balance < 0 && (
                          <button onClick={() => handleOpenAudit(trx)} className="text-amber-600 p-1.5 bg-amber-50 rounded-lg hover:bg-amber-100 animate-pulse" title="Cek Anomali"><Search size={16} /></button>
                        )}
                        <button onClick={() => handleOpenEdit(trx)} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100" title="Edit"><Edit size={16} /></button>
                        <button onClick={() => setVoidTarget(trx)} className="text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100" title="Void (Batalkan)"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PENERIMAAN BBM (PO) - TETAP SAMA */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col border border-slate-200">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-emerald-600 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart size={18} /> Penerimaan BBM dari Supplier</h3>
              <button onClick={() => setIsReceiveModalOpen(false)} className="text-emerald-200 hover:text-white bg-emerald-700 p-1.5 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleReceiveFuel} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pilih PO BBM (Status Open)</label>
                <select required value={receiveData.po_id} onChange={e => setReceiveData({...receiveData, po_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-slate-50">
                  <option value="">-- Pilih PO --</option>
                  {openPOs.map(po => (
                    <option key={po.id} value={po.id}>{po.po_number} - {po.vendors?.name} ({po.total_volume} L)</option>
                  ))}
                </select>
                {openPOs.length === 0 && <p className="text-[10px] text-red-500 mt-1">Tidak ada PO Open. Buat PO baru di menu Pengadaan BBM.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Volume Diterima (Liter)</label>
                <input type="number" required value={receiveData.actual_volume} onChange={e => setReceiveData({...receiveData, actual_volume: e.target.value})} className="w-full border rounded-lg p-2.5 font-mono text-lg" placeholder="0" />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                <button type="button" onClick={() => setIsReceiveModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" disabled={loading || openPOs.length === 0} className="px-6 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : 'Proses Penerimaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL AUDIT ANOMALI BBM (Opsi B) */}
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
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertCircle size={14} className="text-red-500"/> Analisis Kemungkinan Penyebab</h4>
                <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
                  <li><b>Pengisian Liar / Jerigen:</b> Operator mengisi BBM via jerigen, tidak dilaporkan ke Admin.</li>
                  <li><b>Rasio (L/Jam) Terlalu Tinggi:</b> Standar di sistem lebih besar dari pemakaian riil mesin.</li>
                  <li><b>Kebocoran / Pencurian:</b> Terjadi kebocoran selang/tangki, atau hilang dicuri.</li>
                  <li><b>HM Error:</b> Operator salah input HM Akhir, atau odometer mesin rusak.</li>
                </ul>
              </div>
            </div>
            <div className="p-4 border-t bg-white flex justify-end">
              <button onClick={() => setIsAuditModalOpen(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT & VOID TETAP SAMA */}
      {isEditModalOpen && editData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-white"><h3 className="font-bold text-lg text-slate-800">Edit Transaksi BBM</h3><button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-rose-500 p-2 rounded-full hover:bg-rose-50"><X size={20} /></button></div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Pengisian</label><input type="date" required value={editData.transaction_date} onChange={e => setEditData({...editData, transaction_date: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">HM Saat Ini</label><input type="number" step="0.1" required value={editData.hm_recorded} onChange={e => setEditData({...editData, hm_recorded: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm font-mono" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Jumlah Liter</label><input type="number" required value={editData.quantity_liter} onChange={e => setEditData({...editData, quantity_liter: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm font-mono" /></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Beban Kerja</label><select value={editData.work_load_type} onChange={e => setEditData({...editData, work_load_type: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm bg-white"><option value="Low">Ringan (Low)</option><option value="Medium">Sedang (Medium)</option><option value="High">Berat (High)</option></select></div>
              <div className="pt-4 flex justify-end gap-2 border-t mt-4"><button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg">Batal</button><button type="submit" disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg">{loading ? <Loader2 className="animate-spin" size={16} /> : 'Simpan Perubahan'}</button></div>
            </form>
          </div>
        </div>
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Batalkan Transaksi BBM?</h3>
            <p className="text-sm text-slate-500 mb-6">Stok BBM pada tangki akan otomatis dikembalikan sebanyak <b>{voidTarget.quantity_liter} Liter</b>.</p>
            <div className="flex gap-3 justify-center"><button onClick={() => setVoidTarget(null)} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">Batal</button><button onClick={handleVoid} disabled={loading} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex justify-center items-center">{loading ? <Loader2 className="animate-spin" size={18} /> : 'Ya, Batalkan'}</button></div>
          </div>
        </div>
      )}

      {isRateModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-white"><h3 className="font-bold text-lg text-slate-800">Setting Standar Konsumsi BBM</h3><button onClick={() => setIsRateModalOpen(false)} className="text-slate-400 hover:text-rose-500 p-2 rounded-full hover:bg-rose-50"><X size={20} /></button></div>
            <form onSubmit={handleSaveRates} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 mb-2">Biarkan kosong jika ingin menggunakan standar dari Kategori.</p>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Ringan (Low)</label><input type="number" step="0.1" value={rateForm.low} onChange={e => setRateForm({...rateForm, low: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-mono" placeholder="L/Jam" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Sedang (Medium)</label><input type="number" step="0.1" value={rateForm.medium} onChange={e => setRateForm({...rateForm, medium: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-mono" placeholder="L/Jam" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Berat (High)</label><input type="number" step="0.1" value={rateForm.high} onChange={e => setRateForm({...rateForm, high: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-mono" placeholder="L/Jam" /></div>
              <div className="pt-4 flex justify-end gap-2 border-t mt-4"><button type="button" onClick={() => setIsRateModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button><button type="submit" disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">{loading ? <Loader2 className="animate-spin" size={16} /> : 'Simpan Pengaturan'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}