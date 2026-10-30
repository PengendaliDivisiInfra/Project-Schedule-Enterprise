'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AssignmentModal from '../../components/AssignmentModal';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AHSPPage() {
  const [tasks, setTasks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  
  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('wbs_tasks').select('*').eq('summary', 'No').limit(20);
      setTasks(data || []);
    }
    loadData();
  }, []);

  const handleOpenModal = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analisa Harga Satuan Pekerjaan (AHSP)</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <p className="text-gray-500 text-sm">Pilih pekerjaan di bawah ini untuk menyusun komponen Material, Upah, dan Alat.</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
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
                  <button onClick={() => handleOpenModal(t)} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md hover:bg-blue-100 transition text-xs font-medium border border-blue-200">
                    + Kelola Resource
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssignmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} task={selectedTask} />
    </div>
  );
}
