'use client';
import { useState, useEffect } from 'react';


import { supabase } from '../lib/supabase';

export default function AssignmentModal({ isOpen, onClose, ahspTemplate, onSaveSuccess }) {
  const [mode, setMode] = useState('existing');
  const [masterHsd, setMasterHsd] = useState([]);
  const [selectedHsdId, setSelectedHsdId] = useState('');
  const [koefisien, setKoefisien] = useState('');
  
  const [newHsd, setNewHsd] = useState({
    resource_type: 'Bahan',
    nama_item: '',
    unit: '',
    harga_dasar: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('existing');
      setSelectedHsdId('');
      setKoefisien('');
      setNewHsd({ resource_type: 'Bahan', nama_item: '', unit: '', harga_dasar: '' });
      
      const fetchHsd = async () => {
        const { data } = await supabase.from('master_hsd').select('*').order('resource_type');
        setMasterHsd(data || []);
      };
      fetchHsd();
    }
  }, [isOpen]);

  if (!isOpen || !ahspTemplate) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let finalHsdId = selectedHsdId;

      if (mode === 'new') {
        // ⚠️ PERBAIKAN: Cek apakah item sudah ada di master_hsd
        let { data: existingHsd } = await supabase
          .from('master_hsd')
          .select('id')
          .eq('project_id', ahspTemplate.project_id)
          .eq('nama_item', newHsd.nama_item)
          .eq('unit', newHsd.unit)
          .limit(1)
          .maybeSingle();

        if (existingHsd) {
          // Jika sudah ada, gunakan ID yang ada (dan update harganya jika berubah)
          finalHsdId = existingHsd.id;
          await supabase.from('master_hsd').update({ harga_dasar: Number(newHsd.harga_dasar) }).eq('id', finalHsdId);
        } else {
          // Jika belum ada, buat baru
          const { data: insertedHsd, error: insertError } = await supabase
            .from('master_hsd')
            .insert([{
              project_id: ahspTemplate.project_id,
              resource_type: newHsd.resource_type,
              nama_item: newHsd.nama_item,
              unit: newHsd.unit,
              harga_dasar: Number(newHsd.harga_dasar)
            }])
            .select()
            .single();
            
          if (insertError) throw insertError;
          finalHsdId = insertedHsd.id;
        }
      }

      if (!finalHsdId) throw new Error("Pilih komponen atau isi data baru.");

      // Simpan ke detail AHSP
      const { error: detailError } = await supabase.from('ahsp_details').insert([{
        ahsp_template_id: ahspTemplate.id,
        hsd_id: finalHsdId,
        koefisien: Number(koefisien)
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

  const groupedHsd = masterHsd.reduce((acc, curr) => {
    if (!acc[curr.resource_type]) acc[curr.resource_type] = [];
    acc[curr.resource_type].push(curr);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-1">Tambah Komponen AHSP</h2>
        <p className="text-sm text-gray-500 mb-4">Untuk AHSP: <span className="font-semibold text-gray-800">{ahspTemplate.name}</span></p>
        
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button type="button" onClick={() => setMode('existing')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === 'existing' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            Pilih dari Master HSD
          </button>
          <button type="button" onClick={() => setMode('new')} className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === 'new' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            + Input HSD Baru
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {mode === 'existing' ? (
            <div>
              <label className="block text-sm font-medium mb-1">Pilih Komponen (HSD)</label>
              <select required value={selectedHsdId} onChange={e => setSelectedHsdId(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
                <option value="">-- Pilih Komponen --</option>
                {Object.entries(groupedHsd).map(([type, items]) => (
                  <optgroup key={type} label={type.toUpperCase()}>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nama_item} ({item.unit}) - Rp {item.harga_dasar?.toLocaleString('id-ID')}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Jenis Komponen</label>
                  <select required value={newHsd.resource_type} onChange={e => setNewHsd({...newHsd, resource_type: e.target.value})} className="w-full border rounded-lg p-2 text-sm">
                    <option value="Bahan">Bahan / Material</option>
                    <option value="Upah">Tenaga Kerja / Upah</option>
                    <option value="Alat">Peralatan / Sewa Alat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nama Item</label>
                  <input type="text" required placeholder="Contoh: Semen Portland" value={newHsd.nama_item} onChange={e => setNewHsd({...newHsd, nama_item: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Satuan</label>
                  <input type="text" required placeholder="Zak / m3" value={newHsd.unit} onChange={e => setNewHsd({...newHsd, unit: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Harga Satuan (Rp)</label>
                  <input type="number" required placeholder="65000" value={newHsd.harga_dasar} onChange={e => setNewHsd({...newHsd, harga_dasar: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Koefisien (Kuantitas)</label>
            <input type="number" step="0.001" required placeholder="1.5" value={koefisien} onChange={e => setKoefisien(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
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




