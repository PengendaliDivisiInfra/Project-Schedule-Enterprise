'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AHSPPage() {
  const [tasks, setTasks] = useState([]);
  
  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('wbs_tasks').select('*').eq('summary', 'No').limit(20);
      setTasks(data || []);
    }
    loadData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analisa Harga Satuan Pekerjaan (AHSP)</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <p className="text-gray-500 text-sm">Pilih task di bawah ini untuk menghubungkan dengan Resource (Material/Upah).</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition shadow-sm">+ Tambah AHSP</button>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="p-4 text-sm font-semibold text-gray-600">WBS</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Nama Pekerjaan</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-mono text-sm">{t.wbs_code}</td>
                <td className="p-4 text-sm font-medium">{t.name}</td>
                <td className="p-4 text-center">
                  <button className="text-blue-600 hover:underline text-xs">Kelola Resource</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
