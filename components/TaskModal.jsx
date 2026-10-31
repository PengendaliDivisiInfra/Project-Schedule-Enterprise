'use client';
import { useState, useEffect } from 'react';

const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  try { return new Date(dateString).toISOString().split('T')[0]; } catch (e) { return ''; }
};

export default function TaskModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    wbs_code: '', name: '', start_date: '', end_date: '', duration: 1, 
    progress_percent: 0, cost: 0, summary: 'No',
    predecessors: '', task_mode: 'Auto Scheduled', smart_target: 0
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        start_date: formatDateForInput(initialData.start_date),
        end_date: formatDateForInput(initialData.end_date),
        predecessors: initialData.predecessors || '',
        task_mode: initialData.task_mode || 'Auto Scheduled',
        smart_target: Number(initialData.smart_target) || 0
      });
    } else {
      setFormData({ wbs_code: '', name: '', start_date: '', end_date: '', duration: 1, progress_percent: 0, cost: 0, summary: 'No', predecessors: '', task_mode: 'Auto Scheduled', smart_target: 0 });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto pt-10 pb-10">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Edit Task' : 'Tambah Task Baru'}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">WBS Code</label>
              <input type="text" required value={formData.wbs_code} onChange={e => setFormData({...formData, wbs_code: e.target.value})} className="w-full border rounded-lg p-2 text-sm" disabled={initialData?.summary === 'Yes'} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Nama Task</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mulai</label>
              <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} disabled={initialData?.summary === 'Yes'} className={`w-full border rounded-lg p-2 text-sm ${initialData?.summary === 'Yes' ? 'bg-gray-100' : ''}`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Selesai</label>
              <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} disabled={initialData?.summary === 'Yes' || formData.task_mode === 'Auto Scheduled'} className={`w-full border rounded-lg p-2 text-sm ${(initialData?.summary === 'Yes' || formData.task_mode === 'Auto Scheduled') ? 'bg-gray-100 text-gray-500' : ''}`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Durasi (Hari)</label>
              <input type="number" min="1" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} disabled={initialData?.summary === 'Yes'} className={`w-full border rounded-lg p-2 text-sm ${initialData?.summary === 'Yes' ? 'bg-gray-100' : ''}`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Progres (%)</label>
              <input type="number" min="0" max="100" value={formData.progress_percent} onChange={e => setFormData({...formData, progress_percent: e.target.value})} disabled={initialData?.summary === 'Yes'} className={`w-full border rounded-lg p-2 text-sm ${initialData?.summary === 'Yes' ? 'bg-gray-100' : ''}`} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 bg-indigo-50 p-3 rounded-lg border border-indigo-200">
             <div className="col-span-1">
              <label className="block text-sm font-bold text-indigo-800 mb-1">Target Akhir SMART</label>
              <input type="number" value={formData.smart_target} onChange={e => setFormData({...formData, smart_target: e.target.value})} disabled={initialData?.summary === 'Yes'} className="w-full border rounded-lg p-2 text-sm font-bold" placeholder="Cth: 1000" />
              <p className="text-[10px] text-indigo-600 mt-1">Total target volume akhir (Achievable & Measurable).</p>
            </div>
            <div className="col-span-2 flex items-end pb-1">
              <p className="text-xs text-indigo-700 italic">Sistem akan otomatis menghitung <b>Target Per Hari</b> berdasarkan sisa hari kerja efektif menuju tanggal Selesai.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium mb-1">Predecessors (WBS)</label>
              <input type="text" placeholder="Cth: 1.1FS+2d, 1.2SS" value={formData.predecessors} onChange={e => setFormData({...formData, predecessors: e.target.value})} disabled={initialData?.summary === 'Yes'} className={`w-full border rounded-lg p-2 text-sm ${initialData?.summary === 'Yes' ? 'bg-gray-100' : ''}`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Task Mode</label>
              <select value={formData.task_mode} onChange={e => setFormData({...formData, task_mode: e.target.value})} disabled={initialData?.summary === 'Yes'} className={`w-full border rounded-lg p-2 text-sm ${initialData?.summary === 'Yes' ? 'bg-gray-100' : ''}`}>
                <option value="Auto Scheduled">Auto Scheduled</option>
                <option value="Manually Scheduled">Manually Scheduled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipe Baris</label>
              <select value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} disabled={!!initialData} className={`w-full border rounded-lg p-2 text-sm ${!!initialData ? 'bg-gray-200 text-gray-500' : ''}`}>
                <option value="No">Pekerjaan (Leaf)</option>
                <option value="Yes">Summary (Header)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biaya (Rp)</label>
              <input type="number" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} disabled={initialData?.summary === 'Yes' || !!initialData?.ahsp_template_id} className={`w-full border rounded-lg p-2 text-sm ${(initialData?.summary === 'Yes' || !!initialData?.ahsp_template_id) ? 'bg-gray-100' : ''}`} />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Batal</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}
