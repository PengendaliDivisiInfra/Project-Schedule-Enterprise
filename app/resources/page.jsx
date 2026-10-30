'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function ResourcesPage() {
  const [aggregatedResources, setAggregatedResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Ambil tasks yang sudah di-assign AHSP
        const { data: tasks } = await supabase.from('wbs_tasks').select('*').not('ahsp_template_id', 'is', null);
        
        if (!tasks || tasks.length === 0) {
          setLoading(false);
          return;
        }

        const templateIds = [...new Set(tasks.map(t => t.ahsp_template_id))];
        
        // Ambil detail AHSP untuk template tersebut
        const { data: details } = await supabase.from('ahsp_details')
          .select(`koefisien, ahsp_template_id, master_hsd ( id, item_name, resource_type, unit, base_price, kode )`)
          .in('ahsp_template_id', templateIds);

        const grouped = {};
        tasks.forEach(task => {
          const taskDetails = details.filter(d => d.ahsp_template_id === task.ahsp_template_id);
          const volume = task.volume || 0;

          taskDetails.forEach(detail => {
            const hsd = detail.master_hsd;
            if (!hsd) return;

            const totalVol = volume * detail.koefisien;
            const totalCost = totalVol * (hsd.base_price || 0);

            if (!grouped[hsd.id]) {
              grouped[hsd.id] = { ...hsd, total_volume: 0, total_cost: 0 };
            }
            grouped[hsd.id].total_volume += totalVol;
            grouped[hsd.id].total_cost += totalCost;
          });
        });

        const sorted = Object.values(grouped).sort((a, b) => a.resource_type.localeCompare(b.resource_type));
        setAggregatedResources(sorted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Agregasi Kebutuhan Resources (BoQ)</h1>
      <p className="text-sm text-gray-500 mb-4">Data di bawah ini dihitung otomatis dari (Volume Task x Koefisien AHSP).</p>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
            <tr>
              <th className="p-4">Tipe</th>
              <th className="p-4">Kode</th>
              <th className="p-4">Nama Item</th>
              <th className="p-4 text-right">Total Volume</th>
              <th className="p-4">Satuan</th>
              <th className="p-4 text-right">Harga Satuan</th>
              <th className="p-4 text-right">Total Biaya</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100">
            {aggregatedResources.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="p-4 capitalize font-medium text-xs">
                  <span className={`px-2 py-1 rounded-full ${r.resource_type.toLowerCase() === 'upah' ? 'bg-green-100 text-green-700' : r.resource_type.toLowerCase() === 'bahan' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {r.resource_type}
                  </span>
                </td>
                <td className="p-4 font-mono text-xs">{r.kode || '-'}</td>
                <td className="p-4">{r.item_name}</td>
                <td className="p-4 text-right font-bold">{r.total_volume.toFixed(2)}</td>
                <td className="p-4">{r.unit}</td>
                <td className="p-4 text-right">Rp {r.base_price?.toLocaleString('id-ID')}</td>
                <td className="p-4 text-right font-bold text-gray-800">Rp {r.total_cost.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {aggregatedResources.length === 0 && !loading && <div className="p-10 text-center text-gray-500">Belum ada Task yang di-assign ke AHSP atau Volume belum diisi.</div>}
        {loading && <div className="p-6 text-center text-blue-500">Menghitung agregasi...</div>}
      </div>
    </div>
  );
}
