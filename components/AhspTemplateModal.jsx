'use client';
import { useState, useEffect } from 'react';

export default function AhspTemplateModal({ isOpen, onClose, onSave, initialData, isEdit }) {
  const [formData, setFormData] = useState({ name: '', unit: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Jika mode Edit dan datanya ada, isi form. Jika tidak, kosongkan.
    if (isEdit && initialData) {
      setFormData({ name: initialData.name, unit: initialData.unit });
    } else {
      setFormData({ name: '', unit: '' });
    }
  }, [initialData, isOpen, isEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
    } catch (err) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {/* Judul dinamis berdasarkan prop isEdit */}
        <h2 className="text-xl font-bold mb-4">{isEdit ? 'Edit Katalog AHSP' : 'Buat Katalog AHSP Baru'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Pekerjaan (AHSP)</label>
            <input type="text" required placeholder="Contoh: Galian Tanah Biasa" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Satuan</label>
            <input type="text" required placeholder="Contoh: m3" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


