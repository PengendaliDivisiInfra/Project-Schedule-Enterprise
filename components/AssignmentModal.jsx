'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AssignmentModal({ isOpen, onClose, ahspTemplate, onSaveSuccess }) {
  const [formData, setFormData] = useState({
    resource_type: 'Bahan',
    item_name: '',
    unit: '',
    base_price: '',
    koefisien: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ resource_type: 'Bahan', item_name: '', unit: '', base_price: '', koefisien: '' });
    }
  }, [isOpen]);

  if (!isOpen || !ahspTemplate) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Cek apakah komponen ini sudah ada di database HSD (master_hsd)
      let { data: existingHsd } = await supabase
        .from('master_hsd')
        .select('id')
        .eq('item_name', formData.item_name)
        .eq('unit', formData.unit)
        .eq('resource_type', formData.resource_type)
        .limit(1);

      let hsdId;

      if (existingHsd && existingHsd.length > 0) {
        // Jika sudah ada, gunakan ID yang ada (update harga jika berubah)
        hsdId = existingHsd[0].id;
        await supabase.from('master_hsd').update({ base_price: formData.base_price }).eq('id', hsdId);
      } else {
        // Jika belum ada, buat baru di database HSD
        const { data: newHsd, error: insertError } = await supabase
          .from('master_hsd')
          .insert([{
            item_name: formData.item_name,
            unit: formData.unit,
            base_price: Number(formData.base_price),
            resource_type: formData.resource_type,
            project_id: ahspTemplate.project_id
          }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        hsdId = newHsd.id;
      }

      // 2. Masukkan komponen tersebut ke dalam Detail AHSP
      const { error: detailError } = await supabase.from('ahsp_details').insert([{
        project_id: ahspTemplate.project_id,
        ahsp_template_id: ahspTemplate.id,
        resource_id: hsdId,
        koefisien: Number(formData.koefisien)
      }]);

      if (detailError) throw detailError;

      onSaveSuccess();
      onClose();
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-1">Tambah Komponen AHSP</h2>
        <p className="text-sm text-gray-500 mb-4">Untuk AHSP: <span className="font-semibold text-gray-800">{ahspTemplate.name}</span></p>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Jenis Komponen</label>
              <select required value={formData.resource_type} onChange={e => setFormData({...formData, resource_type: e.target.value})} className="w-full border rounded-lg p-2 text-sm">
                <option value="Bahan">Bahan / Material</option>
                <option value="Upah">Tenaga Kerja / Upah</option>
                <option value="Alat">Peralatan / Sewa Alat</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Item</label>
              <input type="text" required placeholder="Contoh: Semen Portland" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Satuan</label>
              <input type="text" required placeholder="Zak / m3" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Harga Satuan (Rp)</label>
              <input type="number" required placeholder="65000" value={formData.base_price} onChange={e => setFormData({...formData, base_price: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Koefisien</label>
              <input type="number" step="0.001" required placeholder="1.5" value={formData.koefisien} onChange={e => setFormData({...formData, koefisien: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Tambahkan ke AHSP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
