'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AssignmentsPage() {
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // Ambil tasks (filter summary='No' agar hanya mengambil pekerjaan daun)
      const { data: tData } = await supabase.from('wbs_tasks').select('*').eq('summary', 'No').order('wbs_code');
      // Ambil templates
      const { data: aData } = await supabase.from('ahsp_templates').select('*');
      
      // LOGIKA PENYARINGAN DUPLIKAT (Menghilangkan task dengan wbs_code yang sama)
      const uniqueTasks = tData 
        ? Array.from(new Map(tData.map(item => [item.wbs_code, item])).values())
        : [];

      setTasks(uniqueTasks);
      setTemplates(aData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssign = async (taskId, templateId, volume) => {
    const { error } = await supabase.from('wbs_tasks')
      .update({ ahsp_template_id: templateId || null, volume: Number(volume) || 0 })
      .eq('id', taskId);
    
    if (error) alert('Gagal update: ' + error.message);
    else fetchData();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Assignment: WBS ke AHSP</h1>
      <p className="text-sm text-gray-500 mb-4">Hubungkan pekerjaan jadwal (WBS) dengan Katalog AHSP dan tentukan volumenya.</p>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
            <tr>
              <th className="p-4">WBS</th>
              <th className="p-4">Nama Task (Jadwal)</th>
              <th className="p-4 w-1/3">Pilih AHSP Template</th>
              <th className="p-4 w-24">Volume</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="p-4 font-mono">{t.wbs_code}</td>
                <td className="p-4 font-medium">{t.name}</td>
                <td className="p-4">
                  <select 
                    value={t.ahsp_template_id || ''} 
                    onChange={(e) => handleAssign(t.id, e.target.value, t.volume)}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="">-- Belum di-assign --</option>
                    {templates.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.unit})</option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <input 
                    type="number" 
                    defaultValue={t.volume || 0} 
                    onBlur={(e) => handleAssign(t.id, t.ahsp_template_id, e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm" 
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && !loading && (
          <div className="p-10 text-center text-gray-500">
            Belum ada data WBS Task (pastikan tipe Task adalah &quot;Pekerjaan Leaf&quot;).
          </div>
        )}
      </div>
    </div>
  );
}
