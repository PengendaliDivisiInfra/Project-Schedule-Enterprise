'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import { Package, AlertTriangle, Info, HelpCircle, Box, ClipboardList, Filter, ShoppingCart, Store, FileText, Search } from 'lucide-react';
import { InventoryManager } from '@/components/inventory/InventoryManager';
import { PurchaseOrderManager } from '@/components/purchase-order/PurchaseOrderManager';
import { VendorManager } from '@/components/vendor/VendorManager';
import { MaterialFlowGuide } from '@/components/material/MaterialFlowGuide';
import { ReportManager } from '@/components/material/ReportManager';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'; // Asumsi file skeleton ada

export default function MaterialsPage() {
  const { activeProjectId } = useProject();
  const [activeTab, setActiveTab] = useState('plan'); 
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
              ...mat, stok_tersedia: stokTersedia, sisa_volume: sisaVolume, sisa_hari: sisaHari,
              sisa_kebutuhan_ideal: sisaKebutuhanIdeal, sisa_waste: sisaWaste, sisa_total_dibeli: sisaTotalDibeli,
              sisa_pengadaan: sisaPengadaan, sisa_estimasi_biaya: sisaEstimasiBiaya,
              lead_time_days: leadTimeDays, is_lead_time_warning: isLeadTimeWarning
            };
          }
          return { 
            ...mat, stok_tersedia: stokTersedia, sisa_volume: 0, sisa_hari: 1, sisa_kebutuhan_ideal: 0, 
            sisa_waste: 0, sisa_total_dibeli: 0, sisa_pengadaan: 0, sisa_estimasi_biaya: 0, is_lead_time_warning: false 
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

  const filteredMaterials = materials.filter(m => 
    m.master_hsd?.nama_item?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.wbs_tasks?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0);
  const formatNum = (num) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);

  const tabClass = (isActive) => 
    `flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap rounded-t-xl ${
      isActive 
        ? 'border-blue-600 text-blue-700 bg-blue-50/80 shadow-[inset_0_-2px_0_0_#2563eb]' 
        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
    }`;

  const ThWithInfo = ({ title, tooltip, className = "" }) => (
    <th className={`p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 ${className}`}>
      <div className="flex items-center gap-1.5 cursor-help" title={tooltip}>
        {title} <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
      </div>
    </th>
  );

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="w-full max-w-[1920px] mx-auto animate-in fade-in duration-300">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 tracking-tight">
              <Package className="text-blue-600 w-7 h-7" /> Material Management
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">Kelola Kebutuhan Material, Pantau Stok Gudang, dan Proses Pengadaan (PO).</p>
          </div>
          
          {activeTab === 'plan' && (
            <div className="relative group w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Cari material atau pekerjaan..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white font-medium" 
              />
            </div>
          )}
        </div>

        <MaterialFlowGuide />

        {/* NAVIGATION TABS */}
        <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-px">
          <button onClick={() => { setActiveTab('plan'); setSearchTerm(''); }} className={tabClass(activeTab === 'plan')}>
            <ClipboardList className="w-4 h-4" /> Requirement Plan
          </button>
          <button onClick={() => { setActiveTab('inventory'); setSearchTerm(''); }} className={tabClass(activeTab === 'inventory')}>
            <Box className="w-4 h-4" /> Stok Gudang
          </button>
          <button onClick={() => { setActiveTab('po'); setSearchTerm(''); }} className={tabClass(activeTab === 'po')}>
            <ShoppingCart className="w-4 h-4" /> Purchase Order
          </button>
          <button onClick={() => { setActiveTab('vendor'); setSearchTerm(''); }} className={tabClass(activeTab === 'vendor')}>
            <Store className="w-4 h-4" /> Master Vendor
          </button>
          <button onClick={() => { setActiveTab('reports'); setSearchTerm(''); }} className={tabClass(activeTab === 'reports')}>
            <FileText className="w-4 h-4" /> Rekap & Laporan
          </button>
        </div>

        {/* CONTENT: REQUIREMENT PLAN */}
        {activeTab === 'plan' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-300">
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">WBS / Pekerjaan</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Nama Material</th>
                      <ThWithInfo title="Sisa Kebutuhan Ideal" tooltip="Rumus: Total Kebutuhan AHSP × (Sisa Volume Pekerjaan / Volume Total)." className="text-right bg-orange-50 text-orange-700" />
                      <ThWithInfo title="Sisa Waste" tooltip="Rumus: Sisa Kebutuhan Ideal × Faktor Waste (%)." className="text-right" />
                      <ThWithInfo title="Sisa Total Dibeli" tooltip="Rumus: Sisa Kebutuhan Ideal + Sisa Waste." className="text-right bg-indigo-50 text-indigo-700" />
                      <ThWithInfo title="Stok Gudang" tooltip="Total Barang Masuk (IN) dikurangi Barang Keluar (OUT)." className="text-right bg-emerald-50 text-emerald-700" />
                      <ThWithInfo title="Net Pengadaan" tooltip="Rumus: Sisa Total Dibeli - Stok Gudang." className="text-right bg-rose-50 text-rose-700" />
                      <ThWithInfo title="Estimasi Biaya" tooltip="Rumus: Net Pengadaan × Harga Satuan." className="text-right" />
                      <ThWithInfo title="Status" tooltip="Peringatan Merah jika Sisa Hari < 14 Hari DAN Net Pengadaan > 0." className="text-center bg-slate-100" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="p-0">
                          <SkeletonLoader rows={6} cols={9} />
                        </td>
                      </tr>
                    ) : filteredMaterials.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-16 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <Package className="w-12 h-12 mb-3 opacity-20" />
                            <p className="font-bold text-lg text-slate-600">Belum ada data material.</p>
                            <p className="text-sm mt-1">Pastikan WBS sudah diisi dan AHSP sudah terhubung.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMaterials.map((m) => {
                        const namaMat = m.master_hsd?.nama_item || 'Unknown';
                        const satuan = m.master_hsd?.satuan || '';
                        
                        return (
                          <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${m.is_lead_time_warning ? 'bg-red-50/40' : ''}`}>
                            <td className="p-4">
                              <div className="font-semibold text-slate-800">{m.wbs_tasks?.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{m.wbs_tasks?.wbs_code}</div>
                            </td>
                            <td className="p-4 font-bold text-slate-700">{namaMat}</td>
                            <td className="p-4 text-right tabular-nums text-orange-700 bg-orange-50/20">{formatNum(m.sisa_kebutuhan_ideal)}</td>
                            <td className="p-4 text-right tabular-nums text-slate-500">{formatNum(m.sisa_waste)}</td>
                            <td className="p-4 text-right tabular-nums font-bold text-indigo-700 bg-indigo-50/20">{formatNum(m.sisa_total_dibeli)} <span className="text-[10px] font-normal">{satuan}</span></td>
                            <td className="p-4 text-right tabular-nums font-bold text-emerald-700 bg-emerald-50/20">{formatNum(m.stok_tersedia)} <span className="text-[10px] font-normal">{satuan}</span></td>
                            <td className="p-4 text-right tabular-nums font-bold text-rose-700 bg-rose-50/20 text-base">{formatNum(m.sisa_pengadaan)} <span className="text-xs font-normal">{satuan}</span></td>
                            <td className="p-4 text-right tabular-nums font-semibold text-slate-700">{formatRp(m.sisa_estimasi_biaya)}</td>
                            <td className="p-4 text-center">
                              {m.is_lead_time_warning ? (
                                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm border border-red-200"><AlertTriangle className="w-3 h-3" /> Butuh Kirim</span>
                              ) : m.sisa_pengadaan === 0 ? (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">Stok Cukup</span>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-200">Aman</span>
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

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 text-sm text-blue-800 mt-4 shadow-sm items-start">
              <Info className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
              <p><b>Transparansi Perhitungan:</b> Arahkan kursor Anda ke ikon <HelpCircle className="w-4 h-4 inline mx-1" /> pada header tabel untuk melihat rumus dan asal data.</p>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && <div className="mt-2 animate-in fade-in"><InventoryManager projectId={activeProjectId} /></div>}
        {activeTab === 'po' && <div className="mt-2 animate-in fade-in"><PurchaseOrderManager projectId={activeProjectId} /></div>}
        {activeTab === 'vendor' && <div className="mt-2 animate-in fade-in"><VendorManager projectId={activeProjectId} /></div>}
        {activeTab === 'reports' && <div className="mt-2 animate-in fade-in"><ReportManager projectId={activeProjectId} /></div>}
      </div>
    </div>
  );
}