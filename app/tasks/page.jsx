'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  
  useEffect(() => {
    // ⚠️ GANTI DENGAN ID PROJECT ANDA
    const projectId = 'GANTI_DENGAN_ID_PROJECT_ANDA'; 
    supabase.from('wbs_tasks').select('*').eq('project_id', projectId)
      .then(({ data }) => setTasks(data || []));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Task Management (WBS)</h1>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b text-sm">
            <tr>
              <th className="p-4">WBS</th>
              <th className="p-4">Nama Task</th>
              <th className="p-4">Start</th>
              <th className="p-4">Finish</th>
              <th className="p-4">Progress</th>
              <th className="p-4">Cost</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {tasks.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="p-4">{t.wbs}</td>
                <td className="p-4 font-medium">{t.name}</td>
                <td className="p-4">{t.start_date}</td>
                <td className="p-4">{t.finish_date}</td>
                <td className="p-4">{t.progress_percent}%</td>
                <td className="p-4">Rp {t.cost?.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && <div className="p-6 text-center text-gray-500">Belum ada data task atau ID Project salah.</div>}
      </div>
    </div>
  );
}
