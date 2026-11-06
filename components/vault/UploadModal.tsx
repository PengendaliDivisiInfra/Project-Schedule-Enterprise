'use client';

import { useState } from 'react';
import { uploadDocument, uploadPhoto } from '@/lib/services/vault.service';
import { supabase } from '@/lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  type: 'document' | 'photo';
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function UploadModal({ isOpen, onClose, projectId, type, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: 'Kontrak',
    task_id: '',
    description: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast('Pilih file terlebih dahulu', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id || '';

      if (type === 'document') {
        await uploadDocument(file, projectId, form.title, form.category, userId);
      } else {
        await uploadPhoto(file, projectId, form.title, form.task_id || null, form.description, userId);
      }
      
      showToast('File berhasil diunggah', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">
          Upload {type === 'document' ? 'Dokumen Legal' : 'Foto Progress'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pilih File</label>
            <input 
              type="file" 
              required 
              accept={type === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx' : 'image/*'}
              onChange={e => setFile(e.target.files?.[0] || null)} 
              className="w-full border rounded p-2" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Judul</label>
            <input type="text" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full border rounded p-2" />
          </div>

          {type === 'document' ? (
            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border rounded p-2">
                <option value="Kontrak">Kontrak</option>
                <option value="Addendum">Addendum</option>
                <option value="Jaminan">Jaminan</option>
                <option value="Perizinan">Perizinan</option>
                <option value="Invoice/PO">Invoice/PO</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">ID Task / WBS (Opsional)</label>
                <input type="text" placeholder="Kosongkan jika umum" value={form.task_id} onChange={e => setForm({...form, task_id: e.target.value})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Deskripsi</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full border rounded p-2" rows={2} />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>
              {loading ? 'Mengunggah...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}