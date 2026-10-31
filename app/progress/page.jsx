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
    daily_volume: 0, // Input Harian
    notes: '' 
  });

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Ambil data task beserta VOLUME dan SATUAN
    const { data: tData } = await supabase
      .from('wbs_tasks')
      .select(`
        id, name, wbs_code, summary, volume,
        ahsp_templates ( unit )
      `)
      .order('wbs_code');
    
    if (tData) {
      const uniqueTasks = Array.from(new Map(tData.map(item => [item.wbs_code, item])).values());

      // 2. FILTER: Hanya Leaf Node (Subtask)
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
    const { data: pData } = await supabase
      .from('daily_progress')
      .select('*, wbs_tasks(name, volume, ahsp_templates(unit))')
      .order('record_date', { ascending: false })
      .limit(50);
      
    setRecords(pData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.task_id) return alert('Pilih Task terlebih dahulu');

    const selectedTask = tasks.find(t => t.id === formData.task_id);
    if (!selectedTask) return;

    try {
      // ⚡ LOGIKA AKUMULASI: Cari volume kumulatif terakhir SEBELUM tanggal ini
      const { data: prevRecords } = await supabase
        .from('daily_progress')
        .select('completed_volume')
        .eq('task_id', formData.task_id)
        .lte('record_date', formData.record_date) // <= tanggal yang diinput
        .order('record_date', { ascending: false })
        .limit(1);

      let previousCumulative = 0;
      if (prevRecords && prevRecords.length > 0) {
        previousCumulative = Number(prevRecords[0].completed_volume) || 0;
      }

      // Hitung Kumulatif Baru & Persentase
      const newCumulative = previousCumulative + Number(formData.daily_volume);
      const calculatedPercent = selectedTask.volume > 0 
        ? Math.min((newCumulative / selectedTask.volume) * 100, 100) 
        : 0;

      const payload = {
        task_id: formData.task_id,
        record_date: formData.record_date,
        actual_cost: Number(formData.actual_cost),
        completed_volume: newCumulative, // Simpan kumulatif ke DB
        progress_percent: calculatedPercent, // Simpan hasil kalkulasi
        notes: formData.notes
      };

      const { error } = await supabase.from('daily_progress').insert([payload]);
      
      if (error) throw error;

      setFormData({ ...formData, actual_cost: 0, daily_volume: 0, notes: '' });
      fetchData();
      alert('Progres Harian berhasil disimpan dan diakumulasikan!');

    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    }
  };

  const selectedTaskUnit = tasks.find(t => t.id === formData.task_id)?.satuan_hsd || '';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Input Progres Harian (Berbasis Volume Harian)</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Pilih Task (Pekerjaan Anak)</label>
            <select required value={formData.task_id} onChange={e => setFormData({...formData, task_id: e.target.value})} className="w-full border rounded p-2 text-sm">
              <option value="">-- Pilih Task --</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>[{t.wbs_code}] {t.name} (Total Rencana: {t.volume} {t.satuan_hsd})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Tanggal Laporan</label>
            <input type="date" required value={formData.record_date} onChange={e => setFormData({...formData, record_date: e.target.value})} className="w-full border rounded p-2 text-sm" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-blue-700 mb-1">Volume Selesai HARI INI</label>
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                step="0.01"
                required 
                value={formData.daily_volume} 
                onChange={e => setFormData({...formData, daily_volume: e.target.value})} 
                className="w-full border-2 border-blue-300 rounded p-2 text-sm font-bold focus:border-blue-500 outline-none" 
                placeholder="Contoh: 0.5"
              />
              <span className="text-xs font-bold text-gray-600 w-12 text-center bg-gray-100 rounded py-2.5">{selectedTaskUnit}</span>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium mb-1">Biaya Aktual HARI INI (Rp)</label>
            <input type="number" required value={formData.actual_cost} onChange={e => setFormData({...formData, actual_cost: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="Contoh: 5000000" />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button type="submit" className="w-full bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition">
              Simpan & Akumulasikan
            </button>
          </div>
          
          <div className="md:col-span-5">
            <p className="text-xs text-gray-500 italic mt-2">
              *Sistem akan otomatis menjumlahkan Volume Hari Ini dengan Volume sebelumnya, lalu menghitung Persentase terhadap Total Rencana.
            </p>
          </div>

        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b font-semibold text-gray-600">
            <tr>
              <th className="p-4">Tanggal</th>
              <th className="p-4">Task</th>
              <th className="p-4 text-right">Vol. Kumulatif</th>
              <th className="p-4 text-center">Progres (%)</th>
              <th className="p-4 text-right">Biaya Aktual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map(r => {
              const unit = r.wbs_tasks?.ahsp_templates?.unit || '';
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-4">{new Date(r.record_date).toLocaleDateString('id-ID')}</td>
                  <td className="p-4 font-medium">{r.wbs_tasks?.name}</td>
                  <td className="p-4 text-right font-bold text-slate-700">
                    {r.completed_volume || 0} {unit}
                  </td>
                  <td className="p-4 text-center font-bold text-blue-600">{Number(r.progress_percent).toFixed(1)}%</td>
                  <td className="p-4 text-right text-gray-700">Rp {r.actual_cost.toLocaleString('id-ID')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {records.length === 0 && !loading && <div className="p-8 text-center text-gray-500">Belum ada data progres harian.</div>}
      </div>
    </div>
  );
}
