'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { data } = await supabase.from('master_hsd').select('*').limit(50);
        setResources(data || []);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    loadData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Master Resources (Material, Alat, Upah)</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
            <tr>
              <th className="p-4">Tipe</th>
              <th className="p-4">Nama Item</th>
              <th className="p-4">Satuan</th>
              <th className="p-4">Harga Dasar</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100">
            {resources.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="p-4 capitalize font-medium">{r.resource_type}</td>
                <td className="p-4">{r.item_name}</td>
                <td className="p-4">{r.unit}</td>
                <td className="p-4">Rp {r.base_price?.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {resources.length === 0 && !loading && <div className="p-10 text-center text-gray-500">Belum ada master resource.</div>}
      </div>
    </div>
  );
}
