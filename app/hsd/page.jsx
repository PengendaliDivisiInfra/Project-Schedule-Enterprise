'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function HSDPage() {
  const [hsd, setHsd] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        let { data: projects } = await supabase.from('projects').select('id').limit(1);
        let projectId = projects?.[0]?.id;

        if (!projectId) {
          let { data: hsdData } = await supabase.from('master_hsd').select('project_id').limit(1);
          projectId = hsdData?.[0]?.project_id;
        }

        if (projectId) {
          const { data } = await supabase.from('master_hsd').select('*').eq('project_id', projectId);
          setHsd(data || []);
        }
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
      <h1 className="text-2xl font-bold mb-6">Harga Satuan Dasar (HSD)</h1>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b text-sm">
            <tr>
              <th className="p-4">Tipe Resource</th>
              <th className="p-4">Nama Item</th>
              <th className="p-4">Satuan</th>
              <th className="p-4">Harga Dasar</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {hsd.map((h) => (
              <tr key={h.id} className="border-b hover:bg-gray-50">
                <td className="p-4 capitalize">{h.resource_type}</td>
                <td className="p-4 font-medium">{h.item_name}</td>
                <td className="p-4">{h.unit}</td>
                <td className="p-4">Rp {h.base_price?.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hsd.length === 0 && !loading && <div className="p-6 text-center text-gray-500">Database HSD kosong. Silakan import data.</div>}
        {loading && <div className="p-6 text-center text-gray-500">Memuat data...</div>}
      </div>
    </div>
  );
}
