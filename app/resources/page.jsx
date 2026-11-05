'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import { Users, Search, Edit, Calculator, CheckCircle, XCircle, X, AlertTriangle, Info, HelpCircle, BarChart3, Filter, ShieldCheck, Settings2, Wand2, CalendarClock, ArrowRight } from 'lucide-react';
import { ResourceCostHeader, ResourceCostCells, useCostSummary } from '@/components/resource-plan/ResourceCostColumns';
import { ResourceHistogram } from '@/components/resource-plan/ResourceHistogram';
import { generateResourceHistogram } from '@/lib/utils/resource-histogram';
import { generateLevelingSuggestion } from '@/lib/utils/resource-leveling';

export default function ResourcesPage() {
  const { activeProjectId } = useProject();
  const [activeTab, setActiveTab] = useState('master'); 
  const [resources, setResources] = useState([]);
  const [planData, setPlanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [manualLimit, setManualLimit] = useState(''); 
  const [isEditingLimit, setIsEditingLimit] = useState(false);

  // State untuk Leveling Modal
  const [isLevelingModalOpen, setIsLevelingModalOpen] = useState(false);
  const [levelingSuggestion, setLevelingSuggestion] = useState(null);
  const [isExecutingLeveling, setIsExecutingLeveling] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState({ name: '', role: '', daily_rate: 0, daily_capacity: 8 });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const costSummary = useCostSummary(planData);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    if (activeTab === 'master') fetchResources();
    else fetchPlanData();
  }, [activeTab, activeProjectId]);

  const fetchResources = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('project_resources').select('*').order('role').order('name');
    if (data) setResources(data);
    if (error) console.error(error);
    setLoading(false);
  };

  const fetchPlanData = async () => {
    if (!activeProjectId) return;
    setLoading(true);

    try {
      const { data: tasks } = await supabase.from('wbs_tasks').select('*').eq('project_id', activeProjectId);
      const { data: resReq } = await supabase.from('v_resource_requirements').select('*').order('wbs_code');

      if (tasks && resReq) {
        const uniqueResReq = resReq.filter((v, i, a) => a.findIndex(t => (t.wbs_code === v.wbs_code && t.resource_name === v.resource_name && t.unit === v.unit)) === i);

        const processedPlan = uniqueResReq.map(req => {
          const task = tasks.find(t => t.wbs_code === req.wbs_code);
          
          if (task && task.volume > 0) {
            const actualVol = task.actual_vol || (task.volume * (task.progress_percent / 100));
            const sisaVolume = Math.max(0, task.volume - actualVol);
            
            const sisaHari = task.end_date ? Math.max(1, Math.ceil((new Date(task.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : 1;
            const targetHarianVol = sisaVolume / sisaHari;
            
            const totalRequirement = Number(req.total_requirement) || 0;
            const proporsiSisa = sisaVolume / task.volume;
            const sisaTotalKebutuhan = totalRequirement * proporsiSisa;
            
            const dailyReq = sisaTotalKebutuhan / sisaHari;
            const kapasitasNyataPerTim = Number(req.capacity_per_day) || 1; 
            const jumlahTim = dailyReq / kapasitasNyataPerTim;

            let rekomendasi = 'Normal';
            if (jumlahTim > 3) rekomendasi = 'Shift';
            else if (jumlahTim > 2) rekomendasi = 'Lembur';

            return {
              ...req,
              task_id: task.id,
              start_date: task.start_date,
              end_date: task.end_date,
              remaining_volume: sisaVolume,
              remaining_days: sisaHari,
              daily_requirement: dailyReq,
              sisa_volume: sisaVolume,
              sisa_hari: sisaHari,
              target_harian_vol: targetHarianVol,
              sisa_total_kebutuhan: isNaN(sisaTotalKebutuhan) ? 0 : sisaTotalKebutuhan,
              jumlah_tim: jumlahTim,
              rekomendasi: rekomendasi
            };
          }
          return { 
            ...req, 
            task_id: task?.id,
            start_date: task?.start_date,
            end_date: task?.end_date,
            remaining_volume: 0, 
            remaining_days: 1, 
            daily_requirement: 0,
            sisa_volume: 0, 
            sisa_hari: 1, 
            target_harian_vol: 0, 
            sisa_total_kebutuhan: 0, 
            jumlah_tim: 0, 
            rekomendasi: 'Normal' 
          };
        });

        setPlanData(processedPlan);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const histogramData = useMemo(() => {
    const uniqueTasks = planData.reduce((acc, current) => {
      if (!acc.find(item => item.wbs_code === current.wbs_code)) acc.push(current);
      return acc;
    }, []);
    return generateResourceHistogram(uniqueTasks);
  }, [planData]);

  const histogramThreshold = useMemo(() => {
    if (manualLimit && !isNaN(Number(manualLimit))) return Number(manualLimit);
    if (!histogramData || histogramData.length === 0) return 1.5;
    
    const teams = histogramData.map(d => d.totalTeams);
    const sum = teams.reduce((a, b) => a + b, 0);
    const avg = sum / teams.length;
    return Math.max(avg * 1.25, 1.5);
  }, [histogramData, manualLimit]);

  const formattedThreshold = histogramThreshold.toFixed(1).replace('.', ',');

  const { deficitTasks, peakDate } = useMemo(() => {
    if (planData.length === 0 || histogramData.length === 0) return { deficitTasks: [], peakDate: null };

    let maxDayTeams = 0;
    let peakDateStr = null;

    histogramData.forEach(d => {
      if (d.totalTeams > maxDayTeams) {
        maxDayTeams = d.totalTeams;
        peakDateStr = d.fullDate;
      }
    });

    if (maxDayTeams <= histogramThreshold) {
      return { deficitTasks: [], peakDate: peakDateStr };
    }

    const activeTasks = planData.filter(p => {
      if (!p.start_date || !p.end_date || p.resource_type === 'Bahan' || p.jumlah_tim <= 0) return false;
      
      const pStart = new Date(p.start_date).toISOString().split('T')[0];
      const pEnd = new Date(p.end_date).toISOString().split('T')[0];
      
      return peakDateStr >= pStart && peakDateStr <= pEnd;
    });

    const sortedTasks = activeTasks.sort((a, b) => b.jumlah_tim - a.jumlah_tim).slice(0, 5);

    return { deficitTasks: sortedTasks, peakDate: peakDateStr };
  }, [planData, histogramData, histogramThreshold]);

  // FUNGSI UNTUK MEMICU LEVELING SUGGESTION
  const handleGenerateLeveling = () => {
    if (!peakDate) return;
    const suggestion = generateLevelingSuggestion(peakDate, deficitTasks, histogramThreshold);
    
    if (suggestion) {
      setLevelingSuggestion(suggestion);
      setIsLevelingModalOpen(true);
    } else {
      showToast('Tidak dapat menemukan solusi pergeseran otomatis.', 'error');
    }
  };

  // FUNGSI UNTUK MENGEKSEKUSI PERGESERAN KE DATABASE
  const executeLeveling = async () => {
    if (!levelingSuggestion) return;
    setIsExecutingLeveling(true);

    try {
      const { error } = await supabase
        .from('wbs_tasks')
        .update({ 
          start_date: levelingSuggestion.new_start, 
          end_date: levelingSuggestion.new_end 
        })
        .eq('id', levelingSuggestion.task_id);

      if (error) throw error;

      showToast('Jadwal berhasil digeser! Memuat ulang data...', 'success');
      setIsLevelingModalOpen(false);
      
      await fetchPlanData();
    } catch (err) {
      showToast('Gagal menggeser jadwal: ' + err.message, 'error');
    } finally {
      setIsExecutingLeveling(false);
    }
  };

  const handleOpenEdit = (res) => {
    setEditingResource(res);
    setFormData({ name: res.name, role: res.role, daily_rate: res.daily_rate, daily_capacity: res.daily_capacity });
    setIsModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('project_resources').update({
      name: formData.name, role: formData.role, daily_rate: Number(formData.daily_rate), daily_capacity: Number(formData.daily_capacity)
    }).eq('id', editingResource.id);

    if (error) showToast('Gagal menyimpan: ' + error.message, 'error');
    else { showToast('Resource berhasil diperbarui!', 'success'); setIsModalOpen(false); fetchResources(); }
    setLoading(false);
  };

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0);
  const formatNum = (num) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const filteredResources = resources.filter(r => r.name?.toLowerCase().includes(searchTerm.toLowerCase()) || r.role?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredPlan = planData.filter(p => p.task_name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.resource_type?.toLowerCase().includes(searchTerm.toLowerCase()));

  const tabClass = (isActive) => 
    `flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 rounded-t-lg whitespace-nowrap ${
      isActive 
        ? 'border-blue-600 text-blue-700 bg-blue-50/50' 
        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen relative w-full">
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      <div className="w-full max-w-[1920px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-blue-600 w-6 h-6" /> Resource Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola Master Data dan Kalkulasi Kebutuhan Resource berdasarkan AHSP & Sisa Volume.</p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200 mb-6 gap-2">
          <div className="flex gap-1 overflow-x-auto w-full md:w-auto pb-0">
            <button onClick={() => { setActiveTab('master'); setSearchTerm(''); }} className={tabClass(activeTab === 'master')}>
              <Users className="w-4 h-4" /> Master Data
            </button>
            <button onClick={() => { setActiveTab('plan'); setSearchTerm(''); }} className={tabClass(activeTab === 'plan')}>
              <Calculator className="w-4 h-4" /> Requirement Plan
            </button>
            <button onClick={() => { setActiveTab('histogram'); setSearchTerm(''); }} className={tabClass(activeTab === 'histogram')}>
              <BarChart3 className="w-4 h-4" /> Histogram Beban Kerja
            </button>
          </div>
          
          <div className="relative group w-full md:w-56 mb-2">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Filter data modul ini..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white text-slate-700" 
            />
          </div>
        </div>

        {activeTab === 'master' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase border-b border-slate-200">
                  <th className="p-4 font-bold">Nama Resource</th>
                  <th className="p-4 font-bold">Role</th>
                  <th className="p-4 font-bold text-right">Biaya Harian</th>
                  <th className="p-4 font-bold text-center">Kapasitas (Jam/Hari)</th>
                  <th className="p-4 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (<tr><td colSpan="5" className="p-8 text-center text-slate-500">Memuat data...</td></tr>) : 
                  filteredResources.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{r.name}</td>
                    <td className="p-4 text-slate-600">{r.role}</td>
                    <td className="p-4 text-right font-mono text-slate-700">{formatRp(r.daily_rate)}</td>
                    <td className="p-4 text-center font-mono font-bold text-indigo-600 bg-indigo-50/50">{r.daily_capacity || 8.0}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleOpenEdit(r)} className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 hover:bg-blue-100 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'plan' && (
          <>
            <div className="mb-4">
              <ResourceCostHeader summary={costSummary} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-max text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs uppercase border-b border-slate-200">
                    <th className="p-3 font-bold text-center">WBS</th>
                    <th className="p-3 font-bold">Uraian Pekerjaan</th>
                    <th className="p-3 font-bold">Resource / Crew</th>
                    <th className="p-3 font-bold text-right">Sisa Vol</th>
                    <th className="p-3 font-bold text-center">Sisa Hari</th>
                    <th className="p-3 font-bold text-right bg-indigo-50 text-indigo-700">Sisa Kebutuhan</th>
                    <th className="p-3 font-bold text-right bg-blue-50 text-blue-700">Target Vol / Hari</th>
                    <th className="p-3 font-bold text-right bg-emerald-50 text-emerald-700 flex items-center justify-end gap-1" title="Dihitung berdasarkan Asumsi Kapasitas 1 Tim = 10 unit/hari">
                      Jumlah Tim <HelpCircle className="w-3 h-3 text-slate-400" />
                    </th>
                    <th className="p-3 font-bold text-center">Rekomendasi</th>
                    <th className="p-3 font-bold text-right bg-teal-50 text-teal-700">Estimasi Sisa Biaya</th>
                    <th className="p-3 font-bold text-center">Rekomendasi Biaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (<tr><td colSpan="11" className="p-8 text-center text-slate-500">Memuat data plan...</td></tr>) : 
                    filteredPlan.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-center text-slate-500">{r.wbs_code}</td>
                      <td className="p-3 font-medium text-slate-800">{r.task_name}</td>
                      <td className="p-3 text-slate-600">{r.resource_name} ({r.resource_type})</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-700">{formatNum(r.sisa_volume)}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-600">{r.sisa_hari} hr</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">
                        {formatNum(r.sisa_total_kebutuhan)} <span className="text-[10px] text-slate-500">{r.unit}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50/30">{formatNum(r.target_harian_vol)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30 text-lg">{formatNum(r.jumlah_tim)}</td>
                      <td className="p-3 text-center">
                        {r.rekomendasi === 'Normal' ? (<span className="text-xs text-slate-400 font-semibold">Normal</span>) : (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> {r.rekomendasi}</span>
                        )}
                      </td>
                      <ResourceCostCells req={r} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'histogram' && (
          <div className="space-y-4">
            
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-2">
                {deficitTasks.length > 0 && (
                  <button 
                    onClick={handleGenerateLeveling} 
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-3 py-1.5 rounded-lg shadow-sm transition-all"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Auto-Level (Cari Solusi)
                  </button>
                )}
              </div>

              {isEditingLimit ? (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-600">Set Limit Max (T/H):</span>
                  <input 
                    type="number" 
                    step="0.1"
                    value={manualLimit} 
                    onChange={(e) => setManualLimit(e.target.value)}
                    className="w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:border-blue-500 font-mono"
                    placeholder={formattedThreshold}
                  />
                  <button onClick={() => setIsEditingLimit(false)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded">Tutup</button>
                </div>
              ) : (
                <button onClick={() => setIsEditingLimit(true)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <Settings2 className="w-3.5 h-3.5" /> Ubah Batas Limit (Manual)
                </button>
              )}
            </div>

            <ResourceHistogram data={histogramData} threshold={histogramThreshold} />
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <h4 className="font-bold text-slate-800 text-sm">Top Pemicu Over-allocation</h4>
                <span className="text-xs text-slate-500">
                  {peakDate ? `Tugas aktif pada puncak beban (${new Date(peakDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })})` : 'Berdasarkan kebutuhan tim tertinggi'}
                </span>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-white text-slate-500 text-xs uppercase border-b border-slate-200">
                    <th className="p-3 font-semibold">Pekerjaan</th>
                    <th className="p-3 font-semibold text-center">Resource</th>
                    <th className="p-3 font-semibold text-right" title="Kebutuhan Puncak Tim per Hari">Kebutuhan Tim/Hari</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deficitTasks.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{t.task_name} <span className="text-xs text-slate-400 font-mono ml-1">({t.wbs_code})</span></td>
                      <td className="p-3 text-center text-slate-600">{t.resource_name}</td>
                      <td className="p-3 text-right">
                        <span className="inline-block bg-rose-50 text-rose-600 px-2 py-1 rounded-md font-semibold border border-rose-100 font-mono text-xs">
                          {formatNum(t.jumlah_tim)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {deficitTasks.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-8 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ShieldCheck className="w-8 h-8 text-emerald-400" />
                          <span className="font-semibold text-slate-700">Tidak Ada Pemicu Over-allocation</span>
                          <span className="text-xs text-slate-500">Semua beban kerja terdistribusi normal di bawah batas aman ({formattedThreshold} T/H).</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border-l-4 border-blue-500 border-y border-r border-slate-200 px-3 py-2 rounded-r-lg flex items-center gap-2 text-xs text-slate-700 shadow-sm print:bg-white print:border-slate-300 print:border-l-slate-500 print:text-black">
              <Info className="w-4 h-4 shrink-0 text-blue-500 print:text-slate-500" />
              <p>
                <span className="font-semibold text-slate-800 mr-1 print:text-black">Panduan:</span>
                Batang <b className="text-rose-600 print:text-black">Merah</b> atau yang menembus garis <b className="text-rose-500 print:text-black">Batas Max ({formattedThreshold} T/H)</b> menandakan penumpukan beban kerja (<i>Over-allocation</i>). Gunakan fitur <b>Auto-Level</b> untuk mencari solusi pergeseran jadwal.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* MODAL LEVELING SUGGESTION */}
      {isLevelingModalOpen && levelingSuggestion && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wand2 className="w-5 h-5 text-blue-600" /> Rekomendasi Resource Leveling</h2>
              <button onClick={() => setIsLevelingModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white/50 p-2 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 flex gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>Sistem mendeteksi penumpukan beban kerja. Kami menyarankan untuk menggeser jadwal pekerjaan berikut agar beban kembali normal.</p>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Pekerjaan yang Disarankan</p>
                  <p className="font-semibold text-slate-800 text-lg">{levelingSuggestion.task_name} <span className="text-sm font-mono text-slate-500">({levelingSuggestion.wbs_code})</span></p>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Jadwal Saat Ini</p>
                    <p className="font-mono text-sm text-slate-700">{formatDate(levelingSuggestion.current_start)}</p>
                    <p className="text-[10px] text-slate-400">s/d</p>
                    <p className="font-mono text-sm text-slate-700">{formatDate(levelingSuggestion.current_end)}</p>
                  </div>
                  
                  <div className="flex flex-col items-center text-blue-500">
                    <ArrowRight className="w-6 h-6" />
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1">+{levelingSuggestion.shift_days} Hari</span>
                  </div>

                  <div className="flex-1 bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-center">
                    <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Jadwal Baru (Saran)</p>
                    <p className="font-mono text-sm text-emerald-700 font-bold">{formatDate(levelingSuggestion.new_start)}</p>
                    <p className="text-[10px] text-emerald-500">s/d</p>
                    <p className="font-mono text-sm text-emerald-700 font-bold">{formatDate(levelingSuggestion.new_end)}</p>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 italic text-center">
                "{levelingSuggestion.reason}"
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={() => setIsLevelingModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-md">Batal</button>
              <button 
                onClick={executeLeveling} 
                disabled={isExecutingLeveling}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md shadow-sm"
              >
                {isExecutingLeveling ? <CalendarClock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {isExecutingLeveling ? 'Memproses...' : 'Terapkan Jadwal Baru'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Edit className="w-5 h-5 text-blue-600" /> Edit Resource</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Resource</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Role / Jabatan</label>
                  <input type="text" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} required className="w-full px-3 py-2 border rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Biaya Harian (Rp)</label>
                    <input type="number" value={formData.daily_rate} onChange={(e) => setFormData({...formData, daily_rate: e.target.value})} className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-600 mb-1">Kapasitas (Jam/Hari)</label>
                    <input type="number" step="0.1" value={formData.daily_capacity} onChange={(e) => setFormData({...formData, daily_capacity: e.target.value})} className="w-full px-3 py-2 border border-indigo-300 rounded-md text-sm font-mono font-bold text-indigo-700 bg-indigo-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-md">Batal</button>
                <button type="submit" className="px-5 py-2 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-md shadow-sm">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}