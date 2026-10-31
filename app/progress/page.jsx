'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ProgressPage() {
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Form Input Baru
  const [formData, setFormData] = useState({ 
    task_id: '', 
    record_date: new Date().toISOString().split('T')[0], 
    actual_cost: 0, 
    daily_volume: 0,
    notes: '' 
  });

  // State untuk Filter Pencarian
  const [searchQuery, setSearchQuery] = useState('');

  // State untuk Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({ record_date: '', completed_volume: 0, actual_cost: 0, notes: '' });

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Ambil SEMUA task (Induk & Anak) beserta Volume & Satuan
    const { data: tData } = await supabase
      .from('wbs_tasks')
      .select(`
        id, name, wbs_code, summary, volume,
        ahsp_templates ( unit )
      `)
      .order('wbs_code');
    
    if (tData) {
      const uniqueTasks = Array.from(new Map(tData.map(item => [item.wbs_code, item])).values());
      
      const processedTasks = uniqueTasks.map(task => {
        const hasChildren = uniqueTasks.some(other => 
          other.wbs_code !== task.wbs_code && 
          other.wbs_code.startsWith(task.wbs_code + '.')
        );
        return {
          ...task,
          is_parent: hasChildren || task.summary === 'Yes',
          satuan_hsd: task.ahsp_templates?.unit || 'unit',
          volume: Number(task.volume) || 0,
          indent_level: task.wbs_code.split('.').length - 1
        };
      });

      setTasks(processedTasks);
    } else {
      setTasks([]);
    }
    
    // 2. Ambil Riwayat Progres
    const { data: pData } = await supabase
      .from('daily_progress')
      .select('*, wbs_tasks(name, wbs_code, volume, ahsp_templates(unit))')
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false });
      
    setRecords(pData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.task_id) return alert('Pilih Task terlebih dahulu');

    const selectedTask = tasks.find(t => t.id === formData.task_id);
    if (!selectedTask || selectedTask.is_parent) return alert('Tidak bisa input progres untuk Summary Task');

    try {
      // Cari volume kumulatif terakhir SEBELUM tanggal ini
      const { data: prevRecords } = await supabase
        .from('daily_progress')
        .select('completed_volume')
        .eq('task_id', formData.task_id)
        .lte('record_date', formData.record_date)
        .order('record_date', { ascending: false })
        .limit(1);

      let previousCumulative = 0;
      if (prevRecords && prevRecords.length > 0) {
        previousCumulative = Number(prevRecords[0].completed_volume) || 0;
      }

      const newCumulative = previousCumulative + Number(formData.daily_volume);
      const calculatedPercent = selectedTask.volume > 0 
        ? Math.min((newCumulative / selectedTask.volume) * 100, 100) 
        : 0;

      const payload = {
        task_id: formData.task_id,
        record_date: formData.record_date,
        actual_cost: Number(formData.actual_cost),
        completed_volume: newCumulative,
        progress_percent: calculatedPercent,
        notes: formData.notes
      };

      const { error } = await supabase.from('daily_progress').insert([payload]);
      if (error) throw error;

      setFormData({ ...formData, actual_cost: 0, daily_volume: 0, notes: '' });
      fetchData();
      alert('Progres Harian berhasil disimpan!');

    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    }
  };

  // --- LOGIKA EDIT ---
  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    setEditFormData({
      record_date: record.record_date,
      completed_volume: record.completed_volume,
      actual_cost: record.actual_cost,
      notes: record.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;

    const selectedTask = tasks.find(t => t.id === editingRecord.task_id);
    if (!selectedTask) return;

    // Hitung ulang persentase berdasarkan volume kumulatif baru
    const calculatedPercent = selectedTask.volume > 0 
      ? Math.min((Number(editFormData.completed_volume) / selectedTask.volume) * 100, 100) 
      : 0;

    try {
      const { error } = await supabase.from('daily_progress').update({
        record_date: editFormData.record_date,
        completed_volume: Number(editFormData.completed_volume),
        actual_cost: Number(editFormData.actual_cost),
        progress_percent: calculatedPercent,
        notes: editFormData.notes
      }).eq('id', editingRecord.id);

      if (error) throw error;
      
      setIsEditModalOpen(false);
      setEditingRecord(null);
      fetchData();
      alert('Data berhasil diperbarui!');
    } catch (err) {
      alert("Gagal update: " + err.message);
    }
  };

  // Filter pencarian
  const filteredRecords = records.filter(r => 
    r.wbs_tasks?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.wbs_tasks?.wbs_code?.includes(searchQuery)
  );

  const selectedTaskUnit = tasks.find(t => t.id === formData.task_id)?.satuan_hsd || '';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Input Progres Harian</h1>
        <p className="text-sm text-gray-500">Laporkan volume pekerjaan harian. Sistem akan menghitung kumulatif dan persentase secara otomatis.</p>
      </div>
      
      {/* FORM INPUT BARU */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 text-gray-700">Pilih Pekerjaan (WBS)</label>
            <select required value={formData.task_id} onChange={e => setFormData({...formData, task_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="">-- Pilih Task --</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id} disabled={t.is_parent} className={t.is_parent ? "font-bold text-gray-400" : "font-medium text-gray-800"}>
                  {t.is_parent ? '📁 ' : '📄 '} {'\u00A0'.repeat(t.indent_level * 4)} [{t.wbs_code}] {t.name} {t.is_parent ? '(Induk)' : `(${t.volume} ${t.satuan_hsd})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700">Tanggal</label>
            <input type="date" required value={formData.record_date} onChange={e => setFormData({...formData, record_date: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-blue-700 mb-1">Volume Hari Ini</label>
            <div className="flex items-center gap-1">
              <input 
                type="number" step="0.01" required value={formData.daily_volume} onChange={e => setFormData({...formData, daily_volume: e.target.value})} 
                className="w-full border-2 border-blue-300 rounded-lg p-2 text-sm font-bold focus:border-blue-500 outline-none" placeholder="Cth: 0.5"
                disabled={!formData.task_id || tasks.find(t=>t.id===formData.task_id)?.is_parent}
              />
              <span className="text-xs font-bold text-gray-600 w-10 text-center bg-gray-100 rounded py-2.5">{selectedTaskUnit}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700">Biaya Aktual (Rp)</label>
            <input type="number" required value={formData.actual_cost} onChange={e => setFormData({...formData, actual_cost: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" disabled={!formData.task_id || tasks.find(t=>t.id===formData.task_id)?.is_parent} placeholder="Cth: 5000000" />
          </div>

          <div>
            <button 
              type="submit" 
              disabled={!formData.task_id || tasks.find(t=>t.id===formData.task_id)?.is_parent}
              className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Simpan Progres
            </button>
          </div>
        </form>
      </div>

      {/* TABEL RIWAYAT (Enterprise Style) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-800">Riwayat Progres Harian</h2>
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="Cari WBS atau Nama Task..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>

        {/* Container Tabel dengan Scroll (Maks 500px) */}
        <div className="max-h-[500px] overflow-y-auto overflow-x-auto relative">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 border-b border-gray-300 sticky top-0 z-10 shadow-sm text-gray-700 font-semibold">
              <tr>
                <th className="p-3 w-32">Tanggal</th>
                <th className="p-3 w-16">WBS</th>
                <th className="p-3">Nama Pekerjaan</th>
                <th className="p-3 text-right">Vol. Kumulatif</th>
                <th className="p-3 text-center">Progres (%)</th>
                <th className="p-3 text-right">Biaya Aktual</th>
                <th className="p-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.map((r, idx) => {
                const unit = r.wbs_tasks?.ahsp_templates?.unit || '';
                return (
                  <tr key={r.id} className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3 font-medium text-slate-600 whitespace-nowrap">
                      {new Date(r.record_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-3 font-mono text-gray-500">{r.wbs_tasks?.wbs_code}</td>
                    <td className="p-3 font-medium">{r.wbs_tasks?.name}</td>
                    <td className="p-3 text-right font-bold text-slate-700 whitespace-nowrap">
                      {r.completed_volume || 0} {unit}
                    </td>
                    <td className="p-3 text-center font-bold text-blue-600">{Number(r.progress_percent).toFixed(1)}%</td>
                    <td className="p-3 text-right text-gray-700 whitespace-nowrap">Rp {r.actual_cost.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => handleOpenEdit(r)} 
                        className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-semibold px-2 py-1 bg-blue-50 rounded border border-blue-200"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRecords.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'Tidak ada data yang cocok dengan pencarian.' : 'Belum ada data progres harian.'}
            </div>
          )}
        </div>
      </div>

      {/* MODAL EDIT */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Edit Data Progres</h3>
            <p className="text-xs text-gray-500 mb-4">Task: <b>{editingRecord.wbs_tasks?.name}</b></p>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Tanggal Laporan</label>
                <input type="date" required value={editFormData.record_date} onChange={e => setEditFormData({...editFormData, record_date: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Volume Kumulatif (Total s/d tanggal ini)</label>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.01" required value={editFormData.completed_volume} onChange={e => setEditFormData({...editFormData, completed_volume: e.target.value})} className="w-full border-2 border-blue-300 rounded-lg p-2 text-sm font-bold focus:border-blue-500 outline-none" />
                  <span className="text-xs font-bold text-gray-600 w-10 text-center bg-gray-100 rounded py-2.5">{editingRecord.wbs_tasks?.ahsp_templates?.unit || 'unit'}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">*Mengubah angka ini akan mengubah persentase progres.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Biaya Aktual (Rp)</label>
                <input type="number" required value={editFormData.actual_cost} onChange={e => setEditFormData({...editFormData, actual_cost: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
