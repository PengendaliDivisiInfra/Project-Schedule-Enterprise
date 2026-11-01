'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Plus } from 'lucide-react';

export default function AssignmentModal({ isOpen, onClose, ahspId, onRefresh }) {
  const [activeTab, setActiveTab] = useState('existing'); // 'existing' | 'new'
  const [hsdList, setHsdList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // State untuk Form Input HSD Baru
  const [formData, setFormData] = useState({
    tipe: 'Bahan', 
    nama_item: '', 
    satuan: 'Unit', // Default value untuk mencegah null
    harga_dasar: 0, 
    koefisien: 1
  });

  const [selectedHsdId, setSelectedHsdId] = useState('');
  const [selectedKoefisien, setSelectedKoefisien] = useState(1);

  useEffect(() => {
    if (isOpen) {
      fetchHsd();
    }
  }, [isOpen]);

  const fetchHsd = async () => {
    setLoading(true);
    const { data } = await supabase.from('master_hsd').select('*').order('nama_item');
    if (data) setHsdList(data);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let finalHsdId = selectedHsdId;

      // JIKA TAB "INPUT BARU" DIPILIH: Simpan dulu ke master_hsd
      if (activeTab === 'new') {
        const payloadHsd = {
          tipe: formData.tipe,
          nama_item: formData.nama_item,
          satuan: formData.satuan || 'Unit', // Pastikan tidak null
          harga_dasar: Number(formData.harga_dasar) || 0
        };

        const { data: newHsd, error: errHsd } = await supabase
          .from('master_hsd')
          .insert([payloadHsd])
          .select()
          .single();

        if (errHsd) throw new Error("Gagal simpan HSD: " + errHsd.message);
        finalHsdId = newHsd.id;
      }

      // SIMPAN KE ahsp_details (Menghubungkan AHSP dengan HSD)
      const payloadDetail = {
        ahsp_template_id: ahspId,
        hsd_id: finalHsdId,
        koefisien: activeTab === 'new' ? Number(formData.koefisien) : Number(selectedKoefisien)
      };

      const { error: errDetail } = await supabase
        .from('ahsp_details')
        .insert([payloadDetail]);

      if (errDetail) throw new Error("Gagal simpan Detail: " + errDetail.message);

      // Sukses
      onRefresh();
      onClose();
      
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Tambah Komponen AHSP</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-200 bg-white">
          <button 
            type="button"
            onClick={() => setActiveTab('existing')} 
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'existing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Pilih dari Master HSD
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('new')} 
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'new' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            + Input HSD Baru
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          
          {/* TAB 1: PILIH DARI MASTER HSD */}
          {activeTab === 'existing' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Komponen (HSD)</label>
                <select 
                  required
                  value={selectedHsdId} 
                  onChange={e => setSelectedHsdId(e.target.value)}
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="" disabled>-- Pilih Komponen --</option>
                  {hsdList.map(hsd => (
                    <option key={hsd.id} value={hsd.id}>
                      [{hsd.tipe}] {hsd.nama_item} - Rp {Number(hsd.harga_dasar).toLocaleString('id-ID')} / {hsd.satuan}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Koefisien (Kuantitas)</label>
                <input required type="number" step="any" value={selectedKoefisien} onChange={e => setSelectedKoefisien(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </>
          )}

          {/* TAB 2: INPUT HSD BARU */}
          {activeTab === 'new' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jenis Komponen</label>
                  <select value={formData.tipe} onChange={e => setFormData({...formData, tipe: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="Bahan">Bahan / Material</option>
                    <option value="Upah">Upah / Tenaga Kerja</option>
                    <option value="Alat">Peralatan / Sewa Alat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Item</label>
                  <input required type="text" value={formData.nama_item} onChange={e => setFormData({...formData, nama_item: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Satuan</label>
                  {/* DROPDOWN SATUAN LENGKAP */}
                  <select 
                    required 
                    value={formData.satuan} 
                    onChange={e => setFormData({...formData, satuan: e.target.value})} 
                    className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="" disabled>-- Pilih Satuan --</option>
                    <option value="Unit">Unit</option>
                    <option value="LS">LS (Lump Sum)</option>
                    <option value="M3">M3 (Kubik)</option>
                    <option value="M2">M2 (Persegi)</option>
                    <option value="M1">M1 (Meter Lari)</option>
                    <option value="Kg">Kg (Kilogram)</option>
                    <option value="Ton">Ton</option>
                    <option value="Zak">Zak</option>
                    <option value="Liter">Liter</option>
                    <option value="OH">OH (Orang Hari)</option>
                    <option value="Jam">Jam</option>
                    <option value="Hari">Hari</option>
                    <option value="Buah">Buah</option>
                    <option value="Set">Set</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Harga Satuan (Rp)</label>
                  <input required type="number" value={formData.harga_dasar} onChange={e => setFormData({...formData, harga_dasar: Number(e.target.value)})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" onFocus={(e) => e.target.select()} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Koefisien (Kuantitas)</label>
                <input required type="number" step="any" value={formData.koefisien} onChange={e => setFormData({...formData, koefisien: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </>
          )}

          {/* FOOTER BUTTONS */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
            <button type="submit" disabled={isSaving} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSaving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : 'Tambahkan ke AHSP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
