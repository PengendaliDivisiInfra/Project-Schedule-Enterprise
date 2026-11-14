'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';
import { 
  Package, AlertTriangle, Info, HelpCircle, Box, ClipboardList, 
  ShoppingCart, Store, FileText, Search, BookOpen, ShieldCheck, 
  CheckCircle2, UserCheck, Calendar, Truck, Wallet, FileSignature, Boxes, ExternalLink
} from 'lucide-react';
import { InventoryManager } from '@/components/inventory/InventoryManager';
import { PurchaseOrderManager } from '@/components/purchase-order/PurchaseOrderManager';
import { VendorManager } from '@/components/vendor/VendorManager';
import { MaterialFlowGuide } from '@/components/material/MaterialFlowGuide';
import { ReportManager } from '@/components/material/ReportManager';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

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

        {activeTab !== 'sop' && <MaterialFlowGuide />}

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
          {/* TAMBAHAN TAB SOP */}
          <button onClick={() => { setActiveTab('sop'); setSearchTerm(''); }} className={tabClass(activeTab === 'sop')}>
            <BookOpen className="w-4 h-4" /> SOP & Panduan
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
        
        {/* CONTENT: SOP & PANDUAN */}
        {activeTab === 'sop' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-5xl">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[500px]">
              
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 border-b pb-2 mb-4"><ShieldCheck className="text-indigo-600"/> 1. Prinsip Utama Material</h2>
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-amber-900 rounded-r-lg">
                    <p className="font-bold mb-2">Dua Aturan Emas (Golden Rules):</p>
                    <ul className="list-disc ml-5 space-y-2">
                      <li><strong>Biaya Proyek (Laba Rugi) ≠ Pembayaran Kas:</strong> Barang yang datang ke proyek (GRN) sudah dihitung sebagai Biaya meskipun belum dibayar ke Supplier. Sebaliknya, uang muka (DP) PO belum dihitung sebagai biaya sebelum barang datang.</li>
                      <li><strong>Pemisahan Biaya (Direct vs Indirect):</strong> Material Utama (Semen, Besi) masuk ke HPP Proyek (WBS). Material Consumable (Paku, Minyak) masuk ke Overhead (OPEX).</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 border-b pb-2 mb-4"><UserCheck className="text-indigo-600"/> 2. Peran & Tanggung Jawab</h2>
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3 border">Peran di Lapangan</th>
                        <th className="p-3 border">Modul ERP yang Diinput</th>
                        <th className="p-3 border">Dampak ke Laporan</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-slate-50"><td className="p-3 border font-bold">Site Engineer</td><td className="p-3 border">Requirement Plan (AHSP)</td><td className="p-3 border">Menentukan Rencana Kebutuhan & Pagu RAP</td></tr>
                      <tr className="hover:bg-slate-50"><td className="p-3 border font-bold">Logistik / Gudang</td><td className="p-3 border">Penerimaan Barang (GRN) & Stock Opname</td><td className="p-3 border">Menentukan Biaya Material Terpasang (HPP)</td></tr>
                      <tr className="hover:bg-slate-50"><td className="p-3 border font-bold">QS / Admin</td><td className="p-3 border">Purchase Order (PO) & Pembayaran</td><td className="p-3 border">Mengakui Utang Usaha & Kas Keluar</td></tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 border-b pb-2 mb-4"><Calendar className="text-indigo-600"/> 3. Alur Kerja Harian Logistik</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border rounded-xl p-5 bg-slate-50">
                      <h3 className="font-bold text-indigo-700 mb-3 flex items-center gap-2"><Truck size={18}/> Barang Datang (IN)</h3>
                      <ol className="list-decimal ml-5 space-y-2 text-sm text-slate-700">
                        <li>Logistik menerima barang & cek fisik dengan Surat Jalan.</li>
                        <li>Buka Tab <strong>Purchase Order</strong> di menu Material.</li>
                        <li>Klik tombol <strong>Terima Barang (GRN)</strong> pada PO terkait.</li>
                        <li>Sistem otomatis menambah Stok Gudang & mencatat Actual Cost.</li>
                      </ol>
                    </div>
                    <div className="border rounded-xl p-5 bg-slate-50">
                      <h3 className="font-bold text-emerald-700 mb-3 flex items-center gap-2"><Boxes size={18}/> Barang Keluar (OUT)</h3>
                      <ol className="list-decimal ml-5 space-y-2 text-sm text-slate-700">
                        <li>Mandor meminta material untuk pekerjaan tertentu.</li>
                        <li>Buka Tab <strong>Stok Gudang</strong> &rarr; Klik <strong>Keluar</strong>.</li>
                        <li>Pilih <strong>Beban Biaya</strong> (WBS atau Overhead).</li>
                        <li>Sistem otomatis memotong Stok & mencatat HPP/OPEX.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 border-b pb-2 mb-4"><CheckCircle2 className="text-indigo-600"/> 4. Checklist Admin Logistik (Interactive)</h2>
                  <p className="text-sm text-slate-500 mb-4">Centang dan ikuti tautan di bawah ini untuk memastikan tidak ada pekerjaan yang terlewat.</p>
                  
                  <div className="space-y-4">
                    {/* ITEM 1: GRN */}
                    <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors bg-white">
                      <input type="checkbox" className="w-5 h-5 mt-1 text-indigo-600 rounded cursor-pointer" />
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2"><Truck size={18} className="text-indigo-600"/> Penerimaan Material (GRN)</h4>
                        <p className="text-sm text-slate-600 mt-1">Apakah ada Surat Jalan material yang datang hari ini?</p>
                        <div className="mt-2 text-xs text-indigo-700 bg-indigo-50 p-2 rounded border border-indigo-100 inline-block">
                          <strong>Cara Input:</strong> Buka menu <strong>Material</strong> &rarr; Tab <strong>Purchase Order</strong> &rarr; Klik tombol <strong>Terima Barang</strong> pada PO terkait.
                        </div>
                      </div>
                      <button onClick={() => setActiveTab('po')} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-200">
                        Ke Menu <ExternalLink size={12}/>
                      </button>
                    </div>

                    {/* ITEM 2: Stok Keluar */}
                    <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors bg-white">
                      <input type="checkbox" className="w-5 h-5 mt-1 text-indigo-600 rounded cursor-pointer" />
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2"><Boxes size={18} className="text-emerald-600"/> Pemakaian Material (Stock OUT)</h4>
                        <p className="text-sm text-slate-600 mt-1">Apakah ada material yang diambil mandor untuk pekerjaan WBS?</p>
                        <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100 inline-block">
                          <strong>Cara Input:</strong> Buka Tab <strong>Stok Gudang</strong> &rarr; Klik <strong>Keluar</strong> pada material &rarr; Pilih WBS tujuan.
                        </div>
                      </div>
                      <button onClick={() => setActiveTab('inventory')} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-200">
                        Ke Menu <ExternalLink size={12}/>
                      </button>
                    </div>

                    {/* ITEM 3: Kas Kecil */}
                    <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50 transition-colors bg-white">
                      <input type="checkbox" className="w-5 h-5 mt-1 text-indigo-600 rounded cursor-pointer" />
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2"><Wallet size={18} className="text-amber-600"/> Kas Kecil / Petty Cash</h4>
                        <p className="text-sm text-slate-600 mt-1">Apakah semua nota kontan (BBM, konsumsi, ATK) sudah diinput?</p>
                        <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 inline-block">
                          <strong>Cara Input:</strong> Buka menu <strong>Cash Flow</strong> &rarr; Klik <strong>+ Tambah Transaksi</strong> &rarr; Tipe: <strong>Kas Keluar</strong>.
                        </div>
                      </div>
                      <a href="/finances" target="_blank" className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-amber-200">
                        Ke Menu <ExternalLink size={12}/>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}