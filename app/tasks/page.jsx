'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    wbs_code: '', name: '', duration: 1, start_date: '', end_date: '', volume: 0, summary: 'No', predecessors: ''
  });

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase.from('wbs_tasks').select('*, ahsp_templates(unit)').order('wbs_code');
    if (data) {
      const uniqueTasks = Array.from(new Map(data.map(item => [item.wbs_code, item])).values());
      setTasks(uniqueTasks.map(t => ({
        ...t,
        satuan_hsd: t.ahsp_templates?.unit || 'unit',
        volume: Number(t.volume) || 0,
        cost: Number(t.cost) || 0
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleOpenAdd = () => {
    setEditingTask(null);
    setFormData({ wbs_code: '', name: '', duration: 1, start_date: '', end_date: '', volume: 0, summary: 'No', predecessors: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setFormData({
      wbs_code: task.wbs_code,
      name: task.name,
      duration: task.duration,
      start_date: task.start_date || '',
      end_date: task.end_date || '',
      volume: task.volume || 0,
      summary: task.summary || 'No',
      predecessors: task.predecessors || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulasi delay kecil agar transisi spinner terlihat halus
    await new Promise(resolve => setTimeout(resolve, 500));

    if (editingTask) {
      await supabase.from('wbs_tasks').update(formData).eq('id', editingTask.id);
      showToast('success', 'Task berhasil diperbarui!');
    } else {
      await supabase.from('wbs_tasks').insert([formData]);
      showToast('success', 'Task baru berhasil ditambahkan!');
    }
    
    setIsSaving(false);
    setIsModalOpen(false);
    fetchTasks();
  };

  const handleDeleteClick = (task) => setDeleteTarget(task);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await supabase.from('wbs_tasks').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    showToast('danger', 'Task berhasil dihapus.');
    fetchTasks();
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) return <LoadingSpinner text="Memuat Tasks..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative overflow-hidden">
      
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* INLINE BANNER ALERT */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="text-sm font-bold text-amber-800">Perhatian Khusus</h4>
            <p className="text-xs text-amber-700">Terdapat 1 Task (WBS 1.1) yang belum memiliki Harga Satuan. Segera lengkapi data di menu Assignments.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-slate-200">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Task Management (CPM Engine)</h1>
              <p className="text-sm text-slate-500">Warna <span className="text-red-500 font-bold">Merah</span> menandakan Jalur Kritis.</p>
            </div>
            <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-colors">
              + Tambah Task
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Hierarki</th>
                  <th className="p-3">Mata Varian</th>
                  <th className="p-3">WBS</th>
                  <th className="p-3">Nama Task</th>
                  <th className="p-3">Volume</th>
                  <th className="p-3">Total Biaya</th>
                  <th className="p-3">Durasi</th>
                  <th className="p-3 text-center">Progres</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => {
                  const isSummary = t.summary === 'Yes';
                  return (
                    <tr key={t.id} className={`hover:bg-slate-50 ${isSummary ? 'bg-slate-50/50 font-bold' : ''} ${t.is_critical ? 'text-red-600' : 'text-slate-700'}`}>
                      <td className="p-3">{isSummary ? '📁' : '📄'}</td>
                      <td className="p-3 text-xs text-slate-500">{isSummary ? '-' : t.mata_varian || '-'}</td>
                      <td className="p-3 font-mono">{t.wbs_code}</td>
                      <td className="p-3">{t.name}</td>
                      <td className="p-3">{isSummary ? '-' : `${t.volume} ${t.satuan_hsd}`}</td>
                      <td className="p-3 font-semibold">{isSummary ? '-' : `Rp ${Number(t.cost).toLocaleString('id-ID')}`}</td>
                      <td className="p-3">{t.duration} d</td>
                      <td className="p-3">
                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div className={`h-2.5 rounded-full ${t.is_critical ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${t.progress_percent || 0}%` }}></div>
                        </div>
                        <span className="text-xs text-center block mt-1">{t.progress_percent || 0}%</span>
                      </td>
                      <td className="p-3 text-center text-blue-600 font-medium text-xs whitespace-nowrap">
                        <button onClick={() => handleOpenEdit(t)} className="hover:underline">Edit</button> | 
                        <button onClick={() => handleDeleteClick(t)} className="text-red-500 hover:underline ml-1">Hapus</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL FORM (TAMBAH / EDIT) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">{editingTask ? '✏️ Edit Task' : '📄 Tambah Task Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">WBS Code</label>
                  <input required type="text" value={formData.wbs_code} onChange={e => setFormData({...formData, wbs_code: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Pekerjaan</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Durasi (Hari)</label>
                  <input required type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Task</label>
                  <select value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="No">Detail Task</option>
                    <option value="Yes">Summary Task</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Start Date</label>
                  <input required type="date" value={formData.start_date || ''} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Finish Date</label>
                  <input required type="date" value={formData.end_date || ''} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2
                    ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                  `}
                >
                  {isSaving ? (
                    <><Loader2 size={16} className="animate-spin" /> Menyimpan...</>
                  ) : (
                    'Simpan Task'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Task Ini?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Anda akan menghapus <strong className="text-slate-800">{deleteTarget.name}</strong>. 
              {deleteTarget.summary === 'Yes' && <span className="block mt-2 text-red-500 font-bold text-xs bg-red-50 p-2 rounded">Peringatan: Menghapus Summary Task akan menghapus seluruh Sub-Task di dalamnya!</span>}
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 w-full">Batal</button>
              <button onClick={handleDeleteConfirm} className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md w-full">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
