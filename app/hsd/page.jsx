'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function HSDPage() {
  const [hsd, setHsd] = useState([]);
  
  useEffect(() => {
    // ⚠️ GANTI DENGAN ID PROJECT ANDA
    const projectId = 'GANTI_DENGAN_ID_PROJECT_ANDA'; 
    supabase.from('master_hsd').select('*').eq('project_id', projectId)
      .then(({ data }) => setHsd(data || []));
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
        {hsd.length === 0 && <div className="p-6 text-center text-gray-500">Belum ada data HSD atau ID Project salah.</div>}
      </div>
    </div>
  );
}
