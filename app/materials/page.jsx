'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import { Package, Search, AlertTriangle, Info, HelpCircle, Box, ClipboardList, Filter } from 'lucide-react';
import { InventoryManager } from '@/components/inventory/InventoryManager';

export default function MaterialsPage() {
  const { activeProjectId } = useProject();
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' atau 'inventory'
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (activeTab === 'plan') {
      fetchMaterials();
    }
  }, [activeProjectId, activeTab]);

  const fetchMaterials = async () => {
    if (!activeProjectId) return;
    setLoading(true);

    try {
      const { data: tasks } = await supabase.from('wbs_tasks').select('*').eq('project_id', activeProjectId);
      
      const { data, error } = await supabase.from('task_material_requirements')
        .select(`
          id, volume_requirement, waste_factor, actual_requirement,
          wbs_tasks ( name, wbs_code, duration ),
          master_hsd ( id, nama_item, satuan, harga_dasar )
        `)
        .order('created_at', { ascending: false });

      const { data: inventoryData } = await supabase.from('inventory_materials').select('*').eq('project_id', activeProjectId);

      if (data && tasks) {
        const processedMat = data.map(mat => {
          const task = tasks.find(t => t.wbs_code === mat.wbs_tasks?.wbs_code);
          const stokTersedia = inventoryData?.find(inv => inv.hsd_id === mat.master_hsd?.id)?.stok_on_hand || 0;

          if (task && task.volume > 0) {
            // RUMUS ENTERPRISE (Diambil dari Sisa Volume)
            const actualVol = task.actual_vol || (task.volume * (task.progress_percent / 100));
            const sisaVolume = Math.max(0, task.volume - actualVol);
            const sisaHari = task.end_date ? Math.max(0, Math.ceil((new Date(task.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : 1;
            
            const proporsiSisa = sisaVolume / task.volume;
            const sisaKebutuhanIdeal = mat.volume_requirement * proporsiSisa;
            const sisaWaste = sisaKebutuhanIdeal * (mat.waste_factor || 0);
            const sisaTotalDibeli = sisaKebutuhanIdeal + sisaWaste;
            const sisaPengadaan = Math.max(0, sisaTotalDibeli - stokTersedia);

            const hargaSatuan = mat.master_hsd?.harga_dasar || 0;
            const sisaEstimasiBiaya = sisaPengadaan * hargaSatuan;

            const leadTimeDays = 14;
            const isLeadTimeWarning = (sisaPengadaan > 0) && (sisaHari <= leadTimeDays);

            return {
              ...mat,
              stok_tersedia: stokTersedia,
              sisa_volume: sisaVolume,
              sisa_hari: sisaHari,
              sisa_kebutuhan_ideal: sisaKebutuhanIdeal,
              sisa_waste: sisaWaste,
              sisa_total_dibeli: sisaTotalDibeli,
              sisa_pengadaan: sisaPengadaan,
              sisa_estimasi_biaya: sisaEstimasiBiaya,
              lead_time_days: leadTimeDays,
              is_lead_time_warning: isLeadTimeWarning
            };
          }
          return { 
            ...mat, stok_tersedia: stokTersedia, sisa_volume: 0, sisa_hari: 1, sisa_kebutuhan_ideal: 0, sisa_waste: 0, sisa_total_dibeli: 0, sisa_pengadaan: 0, sisa_estimasi_biaya: 0, is_lead_time_warning: false 
          };
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
  const formatNum = (num) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);

  const tabClass = (isActive) => 
    `flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 rounded-t-lg whitespace-nowrap ${
      isActive ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
    }`;

  // Helper Component untuk Header dengan Tooltip
  const ThWithInfo = ({ title, tooltip, className = "" }) => (
    <th className={`p-4 font-bold ${className}`}>
      <div className="flex items-center gap-1.5 cursor-help" title={tooltip}>
        {title} <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
      </div>
    </th>
  );

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="w-full max-w-[1920px] mx-auto">
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="text-blue-600 w-6 h-6" /> Material Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">Kelola Kebutuhan Material berdasarkan AHSP (Sisa Volume & Waste) serta Pantau Stok Gudang.</p>
          </div>
          
          {activeTab === 'plan' && (
            <div className="relative group w-full md:w-72">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Filter material atau pekerjaan..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white" 
              />
            </div>
          )}
        </div>

        <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
          <button onClick={() => { setActiveTab('plan'); setSearchTerm(''); }} className={tabClass(activeTab === 'plan')}>
            <ClipboardList className="w-4 h-4" /> Requirement Plan
          </button>
          <button onClick={() => { setActiveTab('inventory'); setSearchTerm(''); }} className={tabClass(activeTab === 'inventory')}>
            <Box className="w-4 h-4" /> Stok Gudang (Inventory)
          </button>
        </div>

        {activeTab === 'plan' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4 font-bold">WBS / Pekerjaan</th>
                    <th className="p-4 font-bold">Nama Material</th>
                    
                    <ThWithInfo 
                      title="Sisa Kebutuhan Ideal" 
                      tooltip="Rumus: Total Kebutuhan AHSP × (Sisa Volume Pekerjaan / Volume Total). Referensi: Tabel task_material_requirements."
                      className="text-right bg-orange-50 text-orange-700" 
                    />
                    
                    <ThWithInfo 
                      title="Sisa Waste" 
                      tooltip="Rumus: Sisa Kebutuhan Ideal × Faktor Waste (%). Referensi: Kolom waste_factor di database."
                      className="text-right" 
                    />
                    
                    <ThWithInfo 
                      title="Sisa Total Dibeli" 
                      tooltip="Rumus: Sisa Kebutuhan Ideal + Sisa Waste. Ini adalah total material fisik yang harus ada untuk menyelesaikan sisa pekerjaan."
                      className="text-right bg-indigo-50 text-indigo-700" 
                    />
                    
                    <ThWithInfo 
                      title="Stok Gudang" 
                      tooltip="Referensi: Total Barang Masuk (IN) dikurangi Barang Keluar (OUT) dari tabel inventory_transactions."
                      className="text-right bg-emerald-50 text-emerald-700" 
                    />
                    
                    <ThWithInfo 
                      title="Net Pengadaan" 
                      tooltip="Rumus: Sisa Total Dibeli - Stok Gudang. Jika hasilnya 0, berarti stok di gudang sudah cukup."
                      className="text-right bg-rose-50 text-rose-700" 
                    />
                    
                    <ThWithInfo 
                      title="Estimasi Biaya" 
                      tooltip="Rumus: Net Pengadaan × Harga Satuan. Referensi harga diambil dari master_hsd (harga_dasar)."
                      className="text-right" 
                    />
                    
                    <ThWithInfo 
                      title="Status" 
                      tooltip="Peringatan Merah jika Sisa Hari < 14 Hari DAN Net Pengadaan > 0. Referensi: Tanggal selesai pekerjaan di tabel wbs_tasks."
                      className="text-center bg-slate-200 text-slate-800" 
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (<tr><td colSpan="9" className="p-8 text-center text-slate-500">Memuat data material...</td></tr>) : 
                    filteredMaterials.length === 0 ? (<tr><td colSpan="9" className="p-8 text-center text-slate-500">Belum ada data material.</td></tr>) : 
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
                          <td className="p-4 text-right font-mono text-orange-700 bg-orange-50/30">{formatNum(m.sisa_kebutuhan_ideal)}</td>
                          <td className="p-4 text-right font-mono text-slate-500">{formatNum(m.sisa_waste)}</td>
                          <td className="p-4 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">{formatNum(m.sisa_total_dibeli)} <span className="text-[10px]">{satuan}</span></td>
                          <td className="p-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">{formatNum(m.stok_tersedia)} <span className="text-[10px]">{satuan}</span></td>
                          <td className="p-4 text-right font-mono font-bold text-rose-700 bg-rose-50/30 text-base">{formatNum(m.sisa_pengadaan)} <span className="text-xs font-normal">{satuan}</span></td>
                          <td className="p-4 text-right font-semibold text-slate-700">{formatRp(m.sisa_estimasi_biaya)}</td>
                          <td className="p-4 text-center">
                            {m.is_lead_time_warning ? (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Butuh Kirim (&lt; {m.lead_time_days} Hr)</span>
                            ) : m.sisa_pengadaan === 0 ? (
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">Stok Cukup</span>
                            ) : (
                              <span className="text-xs text-emerald-600 font-semibold">Aman</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex gap-3 text-sm text-blue-800 mt-4 shadow-sm">
              <Info className="w-5 h-5 shrink-0 text-blue-600" />
              <p><b>Transparansi Perhitungan:</b> Arahkan kursor Anda ke ikon <HelpCircle className="w-4 h-4 inline mx-1" /> pada header tabel untuk melihat rumus dan asal data. Sistem ini 100% dinamis, memotong kebutuhan berdasarkan *Progress* pekerjaan terkini dan *Stok Fisik* di gudang.</p>
            </div>
          </>
        )}

        {activeTab === 'inventory' && (
          <div className="mt-2 animate-in fade-in">
            <InventoryManager projectId={activeProjectId} />
          </div>
        )}

      </div>
    </div>
  );
}