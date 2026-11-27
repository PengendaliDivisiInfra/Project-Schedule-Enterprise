'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { Search, RefreshCw, BarChart3, Database, Loader2, CalendarDays, Download, Plus, X, Save, Camera, ShieldAlert, ShieldCheck, WifiOff } from 'lucide-react';
import { useProject } from '../../context/ProjectContext'; 
import { useRole } from '../../lib/hooks/useRole'; 
import { queueOfflineAction, queueOfflinePhoto, getPendingOfflineCount, processSyncQueue } from '../../lib/services/sync-service';
import { compressFieldPhoto } from '@/lib/utils/image-compressor';
import { checkHseComplianceGateForTask } from '@/lib/services/hse-workforce.service';
import { saveToCache, getFromCache } from '../../lib/utils/cache'; // IMPORT CACHE

export default function ProgressHarianPage() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [rawTasks, setRawTasks] = useState([]); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ task_id: '', volume: '' });
  const [compressedPhoto, setCompressedPhoto] = useState(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [hseGateResult, setHseGateResult] = useState(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState({ records: 0, photos: 0, total: 0 });

  const { activeProjectId } = useProject();
  const { can } = useRole(activeProjectId);
  const canInputProgress = can('EDIT_PROGRESS') || can('INPUT_PROGRESS'); 

  const fetchProgress = async () => {
    if (!activeProjectId) { setLoading(false); return; }

    setLoading(true);
    const cacheKey = `progress_${activeProjectId}`;

    // 1. Ambil dari Cache
    const cached = getFromCache(cacheKey);
    if (cached) {
      setData(cached.data || []);
      setRawTasks(cached.rawTasks || []);
    }

    // 2. Cek Offline
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      if (!cached) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'warning', message: 'Offline & belum ada data cache untuk halaman ini.' } }));
      }
      return;
    }

    // 3. Fetch Online
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const { data: tasks, error: taskErr } = await supabase
        .from('wbs_tasks')
        .select('id, wbs_code, name, volume, satuan_hsd, summary, is_high_risk')
        .eq('project_id', activeProjectId)
        .eq('summary', 'No');
      
      if (taskErr) throw taskErr;

      const safeTasks = tasks || [];
      const taskIds = safeTasks.map(t => t.id);
      let progress = [];
      if (taskIds.length > 0) {
        const { data: progData, error: progErr } = await supabase
          .from('daily_progress')
          .select('*')
          .in('task_id', taskIds);
        if (progErr) throw progErr;
        progress = progData || [];
      }

      const merged = safeTasks.map(t => {
        const taskProgress = progress ? progress.filter(p => p.task_id === t.id) : [];
        
        const todayData = taskProgress.find(p => p.record_date === today);
        const yesterdayData = taskProgress.find(p => p.record_date === yesterday);
        
        const latestData = taskProgress.length > 0 
          ? taskProgress.sort((a, b) => new Date(b.record_date) - new Date(a.record_date))[0] 
          : null;

        const totalRealisasi = latestData ? latestData.completed_volume : 0;
        const realisasiHariIni = todayData ? todayData.completed_volume : 0;
        const realisasiKemarin = yesterdayData ? yesterdayData.completed_volume : 0;

        return {
          ...t,
          realisasi_kemarin: realisasiKemarin,
          realisasi_hari_ini: realisasiHariIni,
          total_realisasi: totalRealisasi,
          progress_pct: t.volume > 0 ? (totalRealisasi / t.volume) * 100 : 0
        };
      });

      const filtered = merged.filter(m => m.total_realisasi > 0);
      filtered.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));
      
      setData(filtered);
      setRawTasks(safeTasks);

      // 4. Simpan ke Cache
      saveToCache(cacheKey, { data: filtered, rawTasks: safeTasks });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [activeProjectId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchProgress();
  };

  const handleExport = () => {
    if (data.length === 0) return;

    const headers = ['WBS', 'Nama Pekerjaan', 'Volume Kontrak', 'Satuan', 'Realisasi Kemarin', 'Realisasi Hari Ini', 'Total s/d Hari Ini', 'Progres (%)'];
    
    const rows = data.map(item => [
      item.wbs_code,
      `"${item.name}"`,
      item.volume,
      item.satuan_hsd,
      item.realisasi_kemarin,
      item.realisasi_hari_ini,
      item.total_realisasi,
      item.progress_pct.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Daily_Progress_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    getPendingOfflineCount().then(setOfflineQueueCount).catch(() => {});
  }, [activeProjectId, isModalOpen]);

  const handleTaskSelection = async (taskId) => {
    setFormData({ ...formData, task_id: taskId });
    setHseGateResult(null);
    const task = rawTasks.find((t) => t.id === taskId);
    if (!task || !activeProjectId || !task.is_high_risk) return;
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const res = await checkHseComplianceGateForTask({
          projectId: activeProjectId,
          wbsCode: task.wbs_code,
          isHighRisk: Boolean(task.is_high_risk),
          recordDate: new Date().toISOString().split('T')[0],
        });
        setHseGateResult(res);
      } catch {
        // Abaikan jika tabel permit belum dimigrasi
      }
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingPhoto(true);
    try {
      const result = await compressFieldPhoto(file, { maxDimension: 1280, quality: 0.72 });
      setCompressedPhoto(result);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: err?.message || 'Gagal mengompresi foto.' } }));
    } finally {
      setCompressingPhoto(false);
    }
  };

  const handleSubmitProgress = async (e) => {
    e.preventDefault();
    if (!formData.task_id || !formData.volume) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: 'Lengkapi semua data!' } }));
      return;
    }

    if (hseGateResult && !hseGateResult.allowed) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: hseGateResult.message } }));
      return;
    }

    setIsSubmitting(true);
    const progressId = crypto.randomUUID();
    const storagePath = compressedPhoto
      ? `${activeProjectId}/prog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`
      : null;

    const payload = {
      id: progressId,
      task_id: formData.task_id,
      completed_volume: parseFloat(formData.volume),
      record_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      ...(storagePath ? { photo_url: storagePath } : {}),
      ...(hseGateResult?.matchedPermitId ? { hse_permit_id: hseGateResult.matchedPermitId } : {}),
    };

    try {
      if (navigator.onLine) {
        if (compressedPhoto && storagePath) {
          const { error: upErr } = await supabase.storage
            .from('evidence')
            .upload(storagePath, compressedPhoto.file, { contentType: 'image/jpeg' });
          if (upErr) throw upErr;
        }

        let { error } = await supabase.from('daily_progress').insert(payload);
        if (error && error.code === '42703') {
          const { photo_url: _p, hse_permit_id: _h, ...legacyPayload } = payload;
          const retry = await supabase.from('daily_progress').insert(legacyPayload);
          error = retry.error;
        }
        if (error) throw error;
        
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: compressedPhoto ? `Progres & foto terkompresi (${compressedPhoto.stats.compressedLabel}) berhasil disimpan!` : 'Progres harian berhasil disimpan!' } }));
        fetchProgress(); 
      } else {
        if (compressedPhoto && storagePath) {
          await queueOfflinePhoto({
            project_id: activeProjectId,
            task_id: formData.task_id,
            daily_progress_id: progressId,
            bucket: 'evidence',
            storage_path: storagePath,
            file_name: compressedPhoto.file.name,
            mime_type: 'image/jpeg',
            data_url: compressedPhoto.dataUrl,
            original_size: compressedPhoto.stats.originalBytes,
            compressed_size: compressedPhoto.stats.compressedBytes,
          });
        }
        await queueOfflineAction('daily_progress', 'INSERT', payload);
        getPendingOfflineCount().then(setOfflineQueueCount).catch(() => {});
      }
      
      setIsModalOpen(false);
      setFormData({ task_id: '', volume: '' });
      setCompressedPhoto(null);
      setHseGateResult(null);
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: err.message || 'Gagal menyimpan data.' } }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatNum = (num) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.wbs_code.includes(searchTerm)
  );

  return (
    <div className="w-full min-h-screen bg-slate-50 p-6 md:p-8 animate-in fade-in duration-500 relative">
      <div className="max-w-[1920px] mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" size={28} /> Rekapitulasi Progress Harian
            </h1>
            <p className="text-sm text-slate-500 mt-1">Pantau histori realisasi volume pekerjaan lapangan secara <em>real-time</em>.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {offlineQueueCount.total > 0 && (
              <button
                onClick={async () => {
                  await processSyncQueue();
                  const c = await getPendingOfflineCount();
                  setOfflineQueueCount(c);
                }}
                className="px-3 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
                title="Klik untuk sinkronisasi antrean offline"
              >
                <WifiOff size={14} /> {offlineQueueCount.total} Antrean Offline ({offlineQueueCount.photos} Foto)
              </button>
            )}
            {canInputProgress && (
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="p-2.5 px-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-sm font-bold"
              >
                <Plus size={16} /> Input Progres
              </button>
            )}

            <button onClick={handleExport} disabled={data.length === 0} className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-50">
              <Download size={16} /> Export
            </button>
            <button onClick={handleRefresh} disabled={isRefreshing} className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-50">
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
            <div className="relative w-full sm:w-96 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Cari kode WBS atau nama pekerjaan..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-700"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Database size={16} /> Total <span className="font-bold text-slate-700">{filteredData.length}</span> Item
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-24">WBS</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 min-w-[250px]">Nama Pekerjaan</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Volume Kontrak</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Satuan</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right bg-orange-50/50">Realisasi Kemarin</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right bg-yellow-50/50">Realisasi Hari Ini</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right bg-emerald-50/50">Total s/d Hari Ini</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center w-32">Progres (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">Memuat data historis...</p>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CalendarDays size={24} className="text-slate-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700 mb-1">Belum Ada Progress Harian</h3>
                      <p className="text-slate-500 text-sm">Silakan input progres terlebih dahulu.</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-mono text-xs font-bold border border-slate-200 group-hover:bg-white group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                          {item.wbs_code}
                        </span>
                      </td>
                      <td className="px-6 py-4"><span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{item.name}</span></td>
                      <td className="px-6 py-4 text-right"><span className="font-mono text-sm tabular-nums text-slate-600">{formatNum(item.volume)}</span></td>
                      <td className="px-6 py-4 text-center"><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.satuan_hsd}</span></td>
                      <td className="px-6 py-4 text-right bg-orange-50/10 group-hover:bg-orange-50/30 transition-colors"><span className="font-mono text-sm tabular-nums font-semibold text-orange-600">{formatNum(item.realisasi_kemarin)}</span></td>
                      <td className="px-6 py-4 text-right bg-yellow-50/10 group-hover:bg-yellow-50/30 transition-colors"><span className="font-mono text-sm tabular-nums font-bold text-yellow-700">{formatNum(item.realisasi_hari_ini)}</span></td>
                      <td className="px-6 py-4 text-right bg-emerald-50/10 group-hover:bg-emerald-50/30 transition-colors"><span className="font-mono text-sm tabular-nums font-bold text-emerald-700">{formatNum(item.total_realisasi)}</span></td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono text-xs font-bold text-indigo-600">{item.progress_pct.toFixed(1)}%</span>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${item.progress_pct}%` }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- CUSTOM MODAL INPUT PROGRES --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Input Progres Harian</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitProgress} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Pekerjaan (WBS)</label>
                <select 
                  value={formData.task_id}
                  onChange={(e) => handleTaskSelection(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-700"
                  required
                >
                  <option value="">-- Pilih Pekerjaan --</option>
                  {rawTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.wbs_code} - {t.name}{t.is_high_risk ? ' [RISIKO TINGGI - HSE GATE]' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Volume Realisasi</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.volume}
                  onChange={(e) => setFormData({...formData, volume: e.target.value})}
                  placeholder="Masukkan angka..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-700"
                  required
                />
              </div>

              {hseGateResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  hseGateResult.allowed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}>
                  {hseGateResult.allowed ? (
                    <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  )}
                  <div>
                    <p className="font-bold">{hseGateResult.message}</p>
                    {!hseGateResult.allowed && (
                      <a href="/qhse" className="underline font-bold text-rose-700 mt-1 inline-block">
                        Terbitkan JSA / Work Permit di Halaman QHSE →
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Foto Progres Lapangan (Kompresi Otomatis &amp; Offline-First)
                </label>
                <label className="cursor-pointer w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 bg-slate-50">
                  {compressingPhoto ? (
                    <><Loader2 size={16} className="animate-spin text-indigo-600" /> Mengompresi foto...</>
                  ) : compressedPhoto ? (
                    <span className="text-emerald-700">
                      ✓ Terkompresi: {compressedPhoto.stats.originalLabel} → {compressedPhoto.stats.compressedLabel} (Hemat {compressedPhoto.stats.savedPercent}%)
                    </span>
                  ) : (
                    <><Camera size={16} className="text-indigo-500" /> Ambil / Pilih Foto Progres (Otomatis Kompres)</>
                  )}
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                </label>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting || compressingPhoto || (hseGateResult && !hseGateResult.allowed)} className="flex-1 px-4 py-2.5 bg-indigo-600 disabled:bg-slate-400 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}