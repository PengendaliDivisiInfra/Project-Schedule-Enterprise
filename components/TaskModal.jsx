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
    predecessors: '', constraints: 'ASAP', task_mode: 'Auto Scheduled', indent_level: 0
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        start_date: formatDateForInput(initialData.start_date),
        end_date: formatDateForInput(initialData.end_date),
        predecessors: initialData.predecessors || '',
        constraints: initialData.constraints || 'ASAP',
        task_mode: initialData.task_mode || 'Auto Scheduled',
        indent_level: initialData.indent_level || 0
      });
    } else {
      setFormData({ wbs_code: '', name: '', start_date: '', end_date: '', duration: 1, progress_percent: 0, cost: 0, summary: 'No', predecessors: '', constraints: 'ASAP', task_mode: 'Auto Scheduled', indent_level: 0 });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto pt-10 pb-10">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Edit Task (MS Project Mode)' : 'Tambah Task Baru'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">WBS Code</label>
              <input type="text" required value={formData.wbs_code} onChange={e => setFormData({...formData, wbs_code: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Nama Task</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mulai</label>
              <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Selesai</label>
              <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Durasi (Hari)</label>
              <input type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Progres (%)</label>
              <input type="number" min="0" max="100" value={formData.progress_percent} onChange={e => setFormData({...formData, progress_percent: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div>
              <label className="block text-sm font-medium mb-1">Predecessors (WBS)</label>
              <input type="text" placeholder="Cth: 1.1, 1.2" value={formData.predecessors} onChange={e => setFormData({...formData, predecessors: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Constraints</label>
              <select value={formData.constraints} onChange={e => setFormData({...formData, constraints: e.target.value})} className="w-full border rounded-lg p-2 text-sm">
                <option value="ASAP">As Soon As Possible</option>
                <option value="MSO">Must Start On</option>
                <option value="MFO">Must Finish On</option>
                <option value="SNET">Start No Earlier Than</option>
                <option value="FNLT">Finish No Later Than</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Task Mode</label>
              <select value={formData.task_mode} onChange={e => setFormData({...formData, task_mode: e.target.value})} className="w-full border rounded-lg p-2 text-sm">
                <option value="Auto Scheduled">Auto Scheduled</option>
                <option value="Manually Scheduled">Manually Scheduled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg border">
            <div>
              <label className="block text-sm font-medium mb-1">Tipe Baris</label>
              <select value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} className="w-full border rounded-lg p-2 text-sm">
                <option value="No">Pekerjaan (Leaf)</option>
                <option value="Yes">Summary (Header)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Indent (Hierarki)</label>
              <input type="number" min="0" max="5" value={formData.indent_level} onChange={e => setFormData({...formData, indent_level: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biaya (Rp)</label>
              <input type="number" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Batal</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
