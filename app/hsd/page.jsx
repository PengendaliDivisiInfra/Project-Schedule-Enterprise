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
        // Mengambil data dari ahsp_details dan menggabungkannya dengan master_hsd
        const { data, error } = await supabase
          .from('ahsp_details')
          .select(`
            master_hsd ( id, item_name, resource_type, unit, base_price, kode )
          `);

        if (error) throw error;

        // 1. Ambil objek master_hsd dan buang yang null
        const allResources = data.map(d => d.master_hsd).filter(Boolean);

        // 2. Filter Duplikat berdasarkan kombinasi Nama, Satuan, dan Harga
        const uniqueResources = Object.values(
          allResources.reduce((acc, curr) => {
            const key = `${curr.item_name}-${curr.unit}-${curr.base_price}`;
            if (!acc[key]) {
              acc[key] = curr;
            }
            return acc;
          }, {})
        );

        // 3. Urutkan berdasarkan Tipe (Upah, Bahan, Alat) lalu Nama
        const sorted = uniqueResources.sort((a, b) => {
          if (a.resource_type !== b.resource_type) {
            return a.resource_type.localeCompare(b.resource_type);
          }
          return a.item_name.localeCompare(b.item_name);
        });

        setHsdList(sorted);
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
          <p className="text-sm text-gray-500 mt-1">Daftar komponen unik yang saat ini digunakan di dalam Katalog AHSP.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
            <tr>
              <th className="p-4">Tipe</th>
              <th className="p-4">Kode</th>
              <th className="p-4">Nama Item</th>
              <th className="p-4">Satuan</th>
              <th className="p-4 text-right">Harga Dasar</th>
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
              </tr>
            ))}
          </tbody>
        </table>
        {hsdList.length === 0 && !loading && (
          <div className="p-10 text-center text-gray-500">
            Belum ada komponen yang digunakan di dalam AHSP.
          </div>
        )}
        {loading && <div className="p-6 text-center text-blue-500">Memuat data HSD...</div>}
      </div>
    </div>
  );
}
