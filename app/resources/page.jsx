'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import { Users, Search, Plus, Edit, Trash2, Calculator, CheckCircle, XCircle, X, AlertTriangle, Info, HelpCircle } from 'lucide-react';

export default function ResourcesPage() {
  const { activeProjectId } = useProject();
  const [activeTab, setActiveTab] = useState('master'); 
  const [resources, setResources] = useState([]);
  const [planData, setPlanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState({ name: '', role: '', daily_rate: 0, daily_capacity: 8 });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

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
        // Menghilangkan duplikasi data berdasarkan WBS & Resource Type
        const uniqueResReq = resReq.filter((v, i, a) => a.findIndex(t => (t.wbs_code === v.wbs_code && t.resource_type === v.resource_type)) === i);

        const processedPlan = uniqueResReq.map(req => {
          const task = tasks.find(t => t.wbs_code === req.wbs_code);
          
          if (task && task.volume > 0) {
            // 🟢 PERBAIKAN: Menggunakan Vol Total dikurangi Vol Realisasi (Actual Vol)
            const actualVol = task.actual_vol || (task.volume * (task.progress_percent / 100));
            const sisaVolume = Math.max(0, task.volume - actualVol);
            
            const sisaHari = task.end_date ? Math.max(1, Math.ceil((new Date(task.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : 1;
            const targetHarianVol = sisaVolume / sisaHari;
            
            const totalKebutuhanRaw = req.total_kebutuhan || req.total_kebutuhan_jam || req.jumlah || 0;
            const proporsiSisa = sisaVolume / task.volume;
            const sisaTotalKebutuhan = Number(totalKebutuhanRaw) * proporsiSisa;
            
            // Asumsi 1 Tim = Kapasitas Nyata 10 unit/hari
            const kapasitasNyataPerTim = 10; 
            const jumlahTim = targetHarianVol / kapasitasNyataPerTim;

            let rekomendasi = 'Normal';
            if (jumlahTim > 3) rekomendasi = 'Shift';
            else if (jumlahTim > 2) rekomendasi = 'Lembur';

            return {
              ...req,
              sisa_volume: sisaVolume,
              sisa_hari: sisaHari,
              target_harian_vol: targetHarianVol,
              sisa_total_kebutuhan: isNaN(sisaTotalKebutuhan) ? 0 : sisaTotalKebutuhan,
              jumlah_tim: jumlahTim,
              rekomendasi: rekomendasi
            };
          }
          return req;
        });

        setPlanData(processedPlan);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
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

  const filteredResources = resources.filter(r => r.name?.toLowerCase().includes(searchTerm.toLowerCase()) || r.role?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredPlan = planData.filter(p => p.task_name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.resource_type?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-indigo-600" /> Resource Management</h1>
              <p className="text-sm text-slate-500 mt-1">Kelola Master Data dan Kalkulasi Kebutuhan Resource berdasarkan AHSP & Sisa Volume.</p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Cari resource..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-72 shadow-sm" />
            </div>
          </div>

          <div className="flex gap-2 border-b border-slate-200">
            <button onClick={() => { setActiveTab('master'); setSearchTerm(''); }} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'master' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Master Data</button>
            <button onClick={() => { setActiveTab('plan'); setSearchTerm(''); }} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'plan' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}><Calculator className="w-4 h-4" /> Requirement Plan (Sisa Volume)</button>
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase border-b border-slate-200">
                  <th className="p-3 font-bold text-center">WBS</th>
                  <th className="p-3 font-bold">Uraian Pekerjaan</th>
                  <th className="p-3 font-bold">Resource / Crew</th>
                  <th className="p-3 font-bold text-right">Sisa Vol</th>
                  <th className="p-3 font-bold text-center">Sisa Hari</th>
                  <th className="p-3 font-bold text-right bg-indigo-50 text-indigo-700">Sisa Kebutuhan (Jam)</th>
                  <th className="p-3 font-bold text-right bg-blue-50 text-blue-700">Target Vol / Hari</th>
                  <th className="p-3 font-bold text-right bg-emerald-50 text-emerald-700 flex items-center justify-end gap-1" title="Dihitung berdasarkan Asumsi Kapasitas 1 Tim = 10 unit/hari">
                    Jumlah Tim <HelpCircle className="w-3 h-3 text-slate-400" />
                  </th>
                  <th className="p-3 font-bold text-center">Rekomendasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (<tr><td colSpan="9" className="p-8 text-center text-slate-500">Memuat data plan...</td></tr>) : 
                  filteredPlan.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-center text-slate-500">{r.wbs_code}</td>
                    <td className="p-3 font-medium text-slate-800">{r.task_name}</td>
                    <td className="p-3 text-slate-600">{r.resource_type || r.resource_crew}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-700">{r.sisa_volume?.toFixed(2)}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-600">{r.sisa_hari} hr</td>
                    <td className="p-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">{r.sisa_total_kebutuhan?.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50/30">{r.target_harian_vol?.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30 text-lg">{r.jumlah_tim?.toFixed(1)}</td>
                    <td className="p-3 text-center">
                      {r.rekomendasi === 'Normal' ? (<span className="text-xs text-slate-400 font-semibold">Normal</span>) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> {r.rekomendasi}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex gap-3 text-sm text-blue-800 mt-4">
            <Info className="w-5 h-5 shrink-0" />
            <p><b>Logika Enterprise:</b> Kolom <b>Jumlah Tim</b> dihitung dari (Target Vol/Hari) dibagi (Kapasitas Nyata 1 Tim = 10 unit/hari). Jika hasilnya &gt; 2, sistem merekomendasikan Lembur/Shift. Sistem belum mendefinisikan jumlah pekerja per tim.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Edit className="w-5 h-5 text-indigo-600" /> Edit Resource</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Resource</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Role / Jabatan</label>
                  <input type="text" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} required className="w-full px-3 py-2 border rounded-md text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Biaya Harian (Rp)</label>
                    <input type="number" value={formData.daily_rate} onChange={(e) => setFormData({...formData, daily_rate: e.target.value})} className="w-full px-3 py-2 border rounded-md text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-600 mb-1">Kapasitas (Jam/Hari)</label>
                    <input type="number" step="0.1" value={formData.daily_capacity} onChange={(e) => setFormData({...formData, daily_capacity: e.target.value})} className="w-full px-3 py-2 border border-indigo-300 rounded-md text-sm font-mono font-bold text-indigo-700 bg-indigo-50" />
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