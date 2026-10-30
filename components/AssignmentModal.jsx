'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AssignmentModal({ isOpen, onClose, ahspTemplate, onSaveSuccess }) {
  const [mode, setMode] = useState('existing'); // 'existing' atau 'new'
  const [masterHsd, setMasterHsd] = useState([]);
  const [selectedHsdId, setSelectedHsdId] = useState('');
  const [koefisien, setKoefisien] = useState('');
  
  // State untuk input baru
  const [newHsd, setNewHsd] = useState({
    resource_type: 'Bahan',
    item_name: '',
    unit: '',
    base_price: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setMode('existing');
      setSelectedHsdId('');
      setKoefisien('');
      setNewHsd({ resource_type: 'Bahan', item_name: '', unit: '', base_price: '' });
      
      // Fetch daftar HSD yang sudah ada
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

      // Jika mode input baru, simpan dulu ke master_hsd
      if (mode === 'new') {
        const { data: insertedHsd, error: insertError } = await supabase
          .from('master_hsd')
          .insert([{
            project_id: ahspTemplate.project_id,
            resource_type: newHsd.resource_type,
            item_name: newHsd.item_name,
            unit: newHsd.unit,
            base_price: Number(newHsd.base_price)
          }])
          .select()
          .single();
          
        if (insertError) throw insertError;
        finalHsdId = insertedHsd.id;
      }

      if (!finalHsdId) throw new Error("Pilih komponen atau isi data baru.");

      // Simpan ke detail AHSP
      const { error: detailError } = await supabase.from('ahsp_details').insert([{
        project_id: ahspTemplate.project_id,
        ahsp_template_id: ahspTemplate.id,
        resource_id: finalHsdId,
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

  // Kelompokkan HSD berdasarkan tipe untuk dropdown
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
        
        {/* Toggle Mode */}
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
                        {item.item_name} ({item.unit}) - Rp {item.base_price?.toLocaleString('id-ID')}
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
                  <input type="text" required placeholder="Contoh: Semen Portland" value={newHsd.item_name} onChange={e => setNewHsd({...newHsd, item_name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Satuan</label>
                  <input type="text" required placeholder="Zak / m3" value={newHsd.unit} onChange={e => setNewHsd({...newHsd, unit: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Harga Satuan (Rp)</label>
                  <input type="number" required placeholder="65000" value={newHsd.base_price} onChange={e => setNewHsd({...newHsd, base_price: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
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
