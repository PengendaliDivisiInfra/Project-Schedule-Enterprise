'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AssignmentModal({ isOpen, onClose, task, onSaveSuccess }) {
  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState('');
  const [koefisien, setKoefisien] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      supabase.from('master_hsd').select('*').then(({ data }) => setResources(data || []));
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('ahsp_details').insert([{
        project_id: task.project_id,
        task_id: task.id,
        resource_id: selectedResource,
        koefisien: Number(koefisien)
      }]);

      if (error) throw error;
      onSaveSuccess(); // Refresh data parent
      onClose();
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-1">Tambah Komponen AHSP</h2>
        <p className="text-sm text-gray-500 mb-4">Task: <span className="font-semibold text-gray-800">{task.name}</span></p>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pilih Resource (HSD)</label>
            <select required value={selectedResource} onChange={e => setSelectedResource(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
              <option value="">-- Pilih --</option>
              {resources.map(r => (
                <option key={r.id} value={r.id}>[{r.resource_type.toUpperCase()}] {r.item_name} ({r.unit})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Koefisien</label>
            <input type="number" step="0.001" required value={koefisien} onChange={e => setKoefisien(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Tambahkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
