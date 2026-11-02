'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Search } from 'lucide-react';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    // PERUBAHAN: Menambahkan duration pada wbs_tasks
    const { data, error } = await supabase
      .from('task_material_requirements')
      .select(`
        id,
        volume_requirement,
        waste_factor,
        actual_requirement,
        wbs_tasks ( name, wbs_code, duration ),
        master_hsd ( nama_item, satuan, harga_dasar )
      `)
      .order('created_at', { ascending: false });

    if (data) setMaterials(data);
    if (error) console.error(error);
    setLoading(false);
  };

  const filteredMaterials = materials.filter(m => 
    m.master_hsd?.nama_item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.wbs_tasks?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="text-indigo-600" /> Material Requirement Plan
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Daftar kebutuhan material aktual berdasarkan Volume Task dan Koefisien AHSP (Termasuk Waste Factor).
            </p>
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
                <th className="p-4 font-bold text-center bg-orange-50 text-orange-700">Berat/Unit</th>
                <th className="p-4 font-bold text-center">Kebutuhan Ideal</th>
                <th className="p-4 font-bold text-center">Waste (5%)</th>
                <th className="p-4 font-bold text-center text-indigo-700 bg-indigo-50">Total Dibeli</th>
                {/* PERUBAHAN: Kolom Delivery Rate */}
                <th className="p-4 font-bold text-center">Delivery / Mgg</th>
                <th className="p-4 font-bold text-right">Estimasi Biaya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-500">Memuat data material...</td></tr>
              ) : filteredMaterials.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-500">Belum ada data material. Pastikan Task sudah di-assign AHSP dan memiliki Volume.</td></tr>
              ) : (
                filteredMaterials.map((m) => {
                  const namaMat = m.master_hsd?.nama_item || 'Unknown';
                  const satuan = m.master_hsd?.satuan || '';
                  const harga = m.master_hsd?.harga_dasar || 0;
                  const totalBiaya = (m.actual_requirement || 0) * harga;
                  
                  // PERUBAHAN: Kalkulasi Delivery Rate per Minggu (Durasi / 7)
                  const durasiMinggu = (m.wbs_tasks?.duration || 1) / 7;
                  const deliveryRate = durasiMinggu > 0 ? (m.actual_requirement / durasiMinggu) : 0;
                  
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-700">{m.wbs_tasks?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{m.wbs_tasks?.wbs_code}</div>
                      </td>
                      <td className="p-4 font-medium text-slate-800">{namaMat}</td>
                    <td className="p-4 text-center font-mono text-slate-600 bg-orange-50/30">
                      {m.master_hsd?.berat_satuan ? `${m.master_hsd.berat_satuan} ${satuan}` : '-'}
                    </td>
                      <td className="p-4 text-center font-mono text-slate-600">
                        {Number(m.volume_requirement).toFixed(2)} <span className="text-xs text-slate-400">{satuan}</span>
                      </td>
                      <td className="p-4 text-center font-mono text-slate-400">
                        {((m.actual_requirement || 0) - (m.volume_requirement || 0)).toFixed(2)} <span className="text-xs">{satuan}</span>
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/50">
                        {Number(m.actual_requirement).toFixed(2)} <span className="text-xs font-normal">{satuan}</span>
                      </td>
                      {/* PERUBAHAN: Data Delivery Rate */}
                      <td className="p-4 text-center font-mono text-emerald-600 font-semibold">
                        {deliveryRate.toFixed(2)} <span className="text-xs font-normal text-slate-400">{satuan}/mgg</span>
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-700">
                        {formatRp(totalBiaya)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}