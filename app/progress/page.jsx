'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ProgressPage() {
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ task_id: '', record_date: new Date().toISOString().split('T')[0], actual_cost: 0, progress_percent: 0, notes: '' });

  const fetchData = async () => {
    setLoading(true);
    const { data: tData } = await supabase.from('wbs_tasks').select('id, name, wbs_code').eq('summary', 'No').order('wbs_code');
    setTasks(tData || []);
    
    const { data: pData } = await supabase.from('daily_progress').select('*, wbs_tasks(name)').order('record_date', { ascending: false }).limit(50);
    setRecords(pData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.task_id) return alert('Pilih Task terlebih dahulu');

    const { error } = await supabase.from('daily_progress').insert([formData]);
    if (error) alert(error.message);
    else {
      setFormData({ ...formData, actual_cost: 0, progress_percent: 0, notes: '' });
      fetchData();
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Input Progres Harian & Biaya Aktual</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Pilih Task (Pekerjaan)</label>
            <select required value={formData.task_id} onChange={e => setFormData({...formData, task_id: e.target.value})} className="w-full border rounded p-2 text-sm">
              <option value="">-- Pilih Task --</option>
              {tasks.map(t => <option key={t.id} value={t.id}>[{t.wbs_code}] {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Tanggal</label>
            <input type="date" required value={formData.record_date} onChange={e => setFormData({...formData, record_date: e.target.value})} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Biaya Aktual (Rp)</label>
            <input type="number" required value={formData.actual_cost} onChange={e => setFormData({...formData, actual_cost: e.target.value})} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Progres (%)</label>
            <input type="number" min="0" max="100" required value={formData.progress_percent} onChange={e => setFormData({...formData, progress_percent: e.target.value})} className="w-full border rounded p-2 text-sm" />
          </div>
          <div className="md:col-span-5 flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">Simpan Progres</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b font-semibold text-gray-600">
            <tr>
              <th className="p-4">Tanggal</th>
              <th className="p-4">Task</th>
              <th className="p-4 text-right">Biaya Aktual</th>
              <th className="p-4 text-center">Progres</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="p-4">{new Date(r.record_date).toLocaleDateString('id-ID')}</td>
                <td className="p-4 font-medium">{r.wbs_tasks?.name}</td>
                <td className="p-4 text-right">Rp {r.actual_cost.toLocaleString('id-ID')}</td>
                <td className="p-4 text-center font-bold text-blue-600">{r.progress_percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
