'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function TaskFormPage({ params }) {
  const router = useRouter();
  const isEdit = params?.id ? true : false;
  
  const [formData, setFormData] = useState({
    wbs_code: '', name: '', duration: 1, start_date: '', end_date: '', volume: 0, summary: 'No'
  });

  useEffect(() => {
    if (isEdit) {
      supabase.from('wbs_tasks').select('*').eq('id', params.id).single().then(({ data }) => {
        if (data) setFormData(data);
      });
    }
  }, [isEdit, params]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEdit) {
      await supabase.from('wbs_tasks').update(formData).eq('id', params.id);
    } else {
      await supabase.from('wbs_tasks').insert([formData]);
    }
    router.push('/tasks');
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold mb-4">{isEdit ? 'Edit Task' : 'Tambah Task Baru'}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-bold mb-1">WBS Code</label><input required type="text" value={formData.wbs_code} onChange={e => setFormData({...formData, wbs_code: e.target.value})} className="w-full border p-2 rounded" /></div>
          <div><label className="block text-sm font-bold mb-1">Nama Pekerjaan</label><input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2 rounded" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-bold mb-1">Durasi (Hari)</label><input required type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} className="w-full border p-2 rounded" /></div>
            <div><label className="block text-sm font-bold mb-1">Tipe</label><select value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} className="w-full border p-2 rounded"><option value="No">Detail Task</option><option value="Yes">Summary Task</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-bold mb-1">Start Date</label><input required type="date" value={formData.start_date || ''} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border p-2 rounded" /></div>
            <div><label className="block text-sm font-bold mb-1">Finish Date</label><input required type="date" value={formData.end_date || ''} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border p-2 rounded" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={() => router.push('/tasks')} className="px-4 py-2 border rounded hover:bg-slate-50">Batal</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

