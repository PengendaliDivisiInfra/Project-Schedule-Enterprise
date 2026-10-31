'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ProgressPage() {
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ 
    task_id: '', 
    record_date: new Date().toISOString().split('T')[0], 
    actual_cost: 0, 
    completed_volume: 0, 
    notes: '' 
  });

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Ambil data task beserta VOLUME dan SATUAN dari AHSP
    const { data: tData } = await supabase
      .from('wbs_tasks')
      .select(`
        id, name, wbs_code, summary, volume,
        ahsp_templates ( unit )
      `)
      .order('wbs_code');
    
    if (tData) {
      const uniqueTasks = Array.from(new Map(tData.map(item => [item.wbs_code, item])).values());

      // 2. FILTER: Hanya ambil "Leaf Node" (Task yang tidak punya anak)
      const leafTasks = uniqueTasks.filter(task => {
        if (task.summary === 'Yes') return false;
        const hasChildren = uniqueTasks.some(other => 
          other.wbs_code !== task.wbs_code && 
          other.wbs_code.startsWith(task.wbs_code + '.')
        );
        return !hasChildren; 
      }).map(t => ({
        ...t,
        satuan_hsd: t.ahsp_templates?.unit || 'unit',
        volume: Number(t.volume) || 0
      }));

      setTasks(leafTasks);
    } else {
      setTasks([]);
    }
    
    // 3. Ambil Riwayat Progres
    const { data: pData } = await supabase.from('daily_progress').select('*, wbs_tasks(name)').order('record_date', { ascending: false }).limit(50);
    setRecords(pData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.task_id) return alert('Pilih Task terlebih dahulu');

    // Cari data task yang dipilih untuk mendapatkan total volume
    const selectedTask = tasks.find(t => t.id === formData.task_id);
    if (!selectedTask) return;

    // HITUNG OTOMATIS PERSENTASE DARI VOLUME
    let calculatedPercent = 0;
    if (selectedTask.volume > 0) {
      calculatedPercent = (Number(formData.completed_volume) / selectedTask.volume) * 100;
    } else {
      calculatedPercent = 0; // Cegah error jika volume 0
    }

    // Batasi maksimal 100%
    calculatedPercent = Math.min(calculatedPercent, 100);

    const payload = {
      task_id: formData.task_id,
      record_date: formData.record_date,
      actual_cost: Number(formData.actual_cost),
      completed_volume: Number(formData.completed_volume),
      progress_percent: calculatedPercent, // Simpan hasil kalkulasi
      notes: formData.notes
    };

    const { error } = await supabase.from('daily_progress').insert([payload]);
    
    if (error) alert(error.message);
    else {
      setFormData({ ...formData, actual_cost: 0, completed_volume: 0, notes: '' });
      fetchData();
    }
  };

  // Dapatkan satuan dari task yang dipilih
  const selectedTaskUnit = tasks.find(t => t.id === formData.task_id)?.satuan_hsd || '';
  const selectedTaskTotalVol = tasks.find(t => t.id === formData.task_id)?.volume || 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Input Progres Harian (Berbasis Volume)</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Pilih Task (Pekerjaan Anak)</label>
            <select required value={formData.task_id} onChange={e => setFormData({...formData, task_id: e.target.value})} className="w-full border rounded p-2 text-sm">
              <option value="">-- Pilih Task --</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>[{t.wbs_code}] {t.name} (Total: {t.volume} {t.satuan_hsd})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Tanggal</label>
            <input type="date" required value={formData.record_date} onChange={e => setFormData({...formData, record_date: e.target.value})} className="w-full border rounded p-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Volume Selesai (Kumulatif)</label>
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                step="0.01"
                required 
                value={formData.completed_volume} 
                onChange={e => setFormData({...formData, completed_volume: e.target.value})} 
                className="w-full border rounded p-2 text-sm" 
                placeholder={selectedTaskTotalVol > 0 ? `Maks: ${selectedTaskTotalVol}` : '0'}
              />
              <span className="text-xs font-bold text-gray-600 w-12 text-center bg-gray-100 rounded py-2">{selectedTaskUnit}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Biaya Aktual (Rp)</label>
            <input type="number" required value={formData.actual_cost} onChange={e => setFormData({...formData, actual_cost: e.target.value})} className="w-full border rounded p-2 text-sm" />
          </div>

          <div className="md:col-span-5 flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500 italic">
              *Sistem akan otomatis menghitung Persentase Progres berdasarkan Volume yang Anda input.
            </p>
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
              <th className="p-4 text-right">Vol. Selesai</th>
              <th className="p-4 text-center">Progres (%)</th>
              <th className="p-4 text-right">Biaya Aktual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="p-4">{new Date(r.record_date).toLocaleDateString('id-ID')}</td>
                <td className="p-4 font-medium">{r.wbs_tasks?.name}</td>
                <td className="p-4 text-right font-bold text-slate-700">{r.completed_volume || 0}</td>
                <td className="p-4 text-center font-bold text-blue-600">{Number(r.progress_percent).toFixed(1)}%</td>
                <td className="p-4 text-right">Rp {r.actual_cost.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && !loading && <div className="p-8 text-center text-gray-500">Belum ada data progres harian.</div>}
      </div>
    </div>
  );
}
