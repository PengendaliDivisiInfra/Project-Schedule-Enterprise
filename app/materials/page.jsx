'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import { Package, Search, AlertTriangle, Info, HelpCircle } from 'lucide-react';

export default function MaterialsPage() {
  const { activeProjectId } = useProject();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, [activeProjectId]);

  const fetchMaterials = async () => {
    if (!activeProjectId) return;
    setLoading(true);

    try {
      const { data: tasks } = await supabase.from('wbs_tasks').select('*').eq('project_id', activeProjectId);
      const { data, error } = await supabase.from('task_material_requirements')
        .select(`
          id, volume_requirement, waste_factor, actual_requirement,
          wbs_tasks ( name, wbs_code, duration ),
          master_hsd ( nama_item, satuan, harga_dasar )
        `)
        .order('created_at', { ascending: false });

      if (data && tasks) {
        const processedMat = data.map(mat => {
          const task = tasks.find(t => t.wbs_code === mat.wbs_tasks?.wbs_code);
          
          if (task && task.volume > 0) {
            const actualVol = task.actual_vol || (task.volume * (task.progress_percent / 100));
            const sisaVolume = Math.max(0, task.volume - actualVol);
            
            const sisaHari = task.end_date ? Math.max(0, Math.ceil((new Date(task.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : 1;
            
            const proporsiSisa = sisaVolume / task.volume;
            const sisaKebutuhanIdeal = mat.volume_requirement * proporsiSisa;
            const sisaWaste = sisaKebutuhanIdeal * (mat.waste_factor || 0);
            const sisaTotalDibeli = sisaKebutuhanIdeal + sisaWaste;

            const stokOnHand = 0; 
            const sisaPengadaan = Math.max(0, sisaTotalDibeli - stokOnHand);

            const hargaSatuan = mat.master_hsd?.harga_dasar || 0;
            const sisaEstimasiBiaya = sisaPengadaan * hargaSatuan;

            const leadTimeDays = 14;
            const isLeadTimeWarning = (sisaPengadaan > 0) && (sisaHari <= leadTimeDays);

            return {
              ...mat,
              sisa_volume: sisaVolume,
              sisa_hari: sisaHari,
              sisa_kebutuhan_ideal: sisaKebutuhanIdeal,
              sisa_waste: sisaWaste,
              sisa_total_dibeli: sisaPengadaan,
              sisa_estimasi_biaya: sisaEstimasiBiaya,
              lead_time_days: leadTimeDays,
              is_lead_time_warning: isLeadTimeWarning
            };
          }
          return mat;
        });

        setMaterials(processedMat);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = materials.filter(m => m.master_hsd?.nama_item?.toLowerCase().includes(searchTerm.toLowerCase()) || m.wbs_tasks?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Package className="text-indigo-600" /> Material Requirement Plan</h1>
            <p className="text-sm text-slate-500 mt-1">Daftar kebutuhan material aktual (Sisa Volume & Waste) dengan peringatan Lead Time.</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Cari material atau pekerjaan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-72 shadow-sm" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-bold">WBS / Pekerjaan</th>
                <th className="p-4 font-bold">Nama Material</th>
                <th className="p-4 font-bold text-right">Sisa Vol Pekerjaan</th>
                <th className="p-4 font-bold text-right bg-orange-50 text-orange-700">Sisa Kebutuhan Ideal</th>
                <th className="p-4 font-bold text-right">Sisa Waste</th>
                <th className="p-4 font-bold text-right bg-indigo-50 text-indigo-700">Sisa Total Dibeli</th>
                <th className="p-4 font-bold text-right">Estimasi Sisa Biaya</th>
                <th className="p-4 font-bold text-center bg-red-50 text-red-700 flex items-center justify-center gap-1" title="Peringatan jika Sisa Hari < Lead Time (14 Hari)">
                  Status Lead Time <HelpCircle className="w-3 h-3 text-slate-400" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (<tr><td colSpan="8" className="p-8 text-center text-slate-500">Memuat data material...</td></tr>) : 
                filteredMaterials.length === 0 ? (<tr><td colSpan="8" className="p-8 text-center text-slate-500">Belum ada data material.</td></tr>) : 
                filteredMaterials.map((m) => {
                  const namaMat = m.master_hsd?.nama_item || 'Unknown';
                  const satuan = m.master_hsd?.satuan || '';
                  
                  return (
                    <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${m.is_lead_time_warning ? 'bg-red-50/30' : ''}`}>
                      <td className="p-4">
                        <div className="font-semibold text-slate-700">{m.wbs_tasks?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{m.wbs_tasks?.wbs_code}</div>
                      </td>
                      <td className="p-4 font-medium text-slate-800">{namaMat}</td>
                      <td className="p-4 text-right font-mono text-slate-500">{m.sisa_volume?.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono font-bold text-orange-700 bg-orange-50/30">{m.sisa_kebutuhan_ideal?.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-slate-500">{m.sisa_waste?.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30 text-base">{m.sisa_total_dibeli?.toFixed(2)} <span className="text-xs font-normal">{satuan}</span></td>
                      <td className="p-4 text-right font-semibold text-slate-700">{formatRp(m.sisa_estimasi_biaya)}</td>
                      <td className="p-4 text-center">
                        {m.is_lead_time_warning ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Butuh Pengiriman (&lt; {m.lead_time_days} Hari)</span>
                        ) : (<span className="text-xs text-emerald-600 font-semibold">Aman</span>)}
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex gap-3 text-sm text-orange-800 mt-4">
          <Info className="w-5 h-5 shrink-0" />
          <p><b>Logika Enterprise:</b> Tabel ini menghitung <b>Sisa Total Dibeli</b> berdasarkan proporsi Sisa Volume ditambah Waste. <b>Stok Gudang (On-Hand) saat ini diasumsikan 0</b> karena belum ada modul Inventory. Status Lead Time menyala merah jika <b>Sisa Hari &lt; 14 Hari</b> DAN Sisa Barang &gt; 0.</p>
        </div>
      </div>
    </div>
  );
}