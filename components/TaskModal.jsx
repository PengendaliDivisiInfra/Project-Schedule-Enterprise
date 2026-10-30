'use client';
import { useState, useEffect } from 'react';

export default function TaskModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    wbs_code: '', name: '', start_date: '', end_date: '', duration: 1, progress_percent: 0, cost: 0, summary: 'No'
  });

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else setFormData({ wbs_code: '', name: '', start_date: '', end_date: '', duration: 1, progress_percent: 0, cost: 0, summary: 'No' });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Edit Task' : 'Tambah Task Baru'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">WBS Code</label>
              <input type="text" required value={formData.wbs_code} onChange={e => setFormData({...formData, wbs_code: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipe</label>
              <select value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} className="w-full border rounded-lg p-2 text-sm">
                <option value="No">Pekerjaan (Leaf)</option>
                <option value="Yes">Summary (Header)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Task</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mulai</label>
              <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Selesai</label>
              <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
             <div>
              <label className="block text-sm font-medium mb-1">Durasi (Hari)</label>
              <input type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Progres (%)</label>
              <input type="number" min="0" max="100" value={formData.progress_percent} onChange={e => setFormData({...formData, progress_percent: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
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
