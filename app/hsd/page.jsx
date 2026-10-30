'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function HSDPage() {
  const [hsdList, setHsdList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Query bersarang: HSD -> Detail AHSP -> Template AHSP -> Task (WBS)
        const { data, error } = await supabase
          .from('ahsp_details')
          .select(`
            master_hsd ( id, item_name, resource_type, unit, base_price, kode ),
            ahsp_templates (
              name,
              wbs_tasks ( name, wbs_code )
            )
          `);

        if (error) throw error;

        // Logika Pengelompokan & Pelacakan
        const grouped = {};

        data.forEach(row => {
          const hsd = row.master_hsd;
          const template = row.ahsp_templates;
          
          if (!hsd) return;

          // Kunci unik berdasarkan Nama, Satuan, dan Harga
          const key = `${hsd.item_name}-${hsd.unit}-${hsd.base_price}`;

          if (!grouped[key]) {
            grouped[key] = {
              ...hsd,
              usages: new Set() // Gunakan Set agar tidak ada teks yang duplikat
            };
          }

          // Format teks penggunaan
          if (template) {
            let usageText = `AHSP: ${template.name}`;
            
            // Jika AHSP ini sudah di-assign ke Task (WBS)
            if (template.wbs_tasks && template.wbs_tasks.length > 0) {
               // Ambil task pertama (karena relasi wbs_tasks ke ahsp_template_id biasanya 1 ke banyak)
               // Kita tampilkan semua task yang menggunakan AHSP ini
               const taskNames = template.wbs_tasks.map(t => `[${t.wbs_code}] ${t.name}`).join(', ');
               usageText += ` ➔ Task: ${taskNames}`;
            } else {
               usageText += ` ➔ (Belum di-assign ke Task)`;
            }
            
            grouped[key].usages.add(usageText);
          }
        });

        // Ubah Set menjadi Array dan urutkan berdasarkan Tipe
        const result = Object.values(grouped).map(item => ({
          ...item,
          usages: Array.from(item.usages)
        })).sort((a, b) => {
          if (a.resource_type !== b.resource_type) {
            return a.resource_type.localeCompare(b.resource_type);
          }
          return a.item_name.localeCompare(b.item_name);
        });

        setHsdList(result);
      } catch (err) {
        console.error("Gagal memuat HSD:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Harga Satuan Dasar (HSD)</h1>
          <p className="text-sm text-gray-500 mt-1">Daftar komponen unik yang digunakan di AHSP beserta lokasi penggunaannya.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
            <tr>
              <th className="p-4 w-24">Tipe</th>
              <th className="p-4 w-24">Kode</th>
              <th className="p-4">Nama Item</th>
              <th className="p-4 w-20">Satuan</th>
              <th className="p-4 w-32 text-right">Harga Dasar</th>
              <th className="p-4 w-1/3">Digunakan Pada (AHSP / Task)</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100">
            {hsdList.map((r, index) => (
              <tr key={`${r.id}-${index}`} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 capitalize font-medium text-xs">
                  <span className={`px-2 py-1 rounded-full ${
                    r.resource_type?.toLowerCase() === 'upah' ? 'bg-green-100 text-green-700' : 
                    r.resource_type?.toLowerCase() === 'bahan' ? 'bg-blue-100 text-blue-700' : 
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {r.resource_type}
                  </span>
                </td>
                <td className="p-4 font-mono text-xs">{r.kode || '-'}</td>
                <td className="p-4 font-medium">{r.item_name}</td>
                <td className="p-4 text-gray-600">{r.unit}</td>
                <td className="p-4 text-right font-bold text-gray-800">Rp {r.base_price?.toLocaleString('id-ID')}</td>
                <td className="p-4">
                  <div className="flex flex-col gap-1.5">
                    {r.usages.map((usage, i) => (
                      <div key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200 w-fit">
                        {usage}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hsdList.length === 0 && !loading && (
          <div className="p-10 text-center text-gray-500">
            Belum ada komponen HSD yang digunakan di dalam AHSP.
          </div>
        )}
        {loading && <div className="p-6 text-center text-blue-500">Memuat data pelacakan HSD...</div>}
      </div>
    </div>
  );
}
