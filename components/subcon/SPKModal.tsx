'use client';

import { useState, useEffect } from 'react';
import { createSPK, updateSPK } from '@/lib/services/subcon.service';
import { Subcontractor, SubcontractorContract } from '@/lib/types/subcon';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  subcontractors: Subcontractor[];
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  editingSPK?: SubcontractorContract | null;
}

interface SPKItem {
  description: string;
  volume: number;
  unit: string;
  unit_price: number;
}

export function SPKModal({ isOpen, onClose, projectId, subcontractors, onSuccess, showToast, editingSPK }: Props) {
  const [loading, setLoading] = useState(false);
  const isEditMode = !!editingSPK;

  const [form, setForm] = useState({
    subcontractor_id: '',
    spk_number: '',
    work_description: '',
    retention_pct: 5,
    ppn_pct: 11,
    pph_pct: 2,
    tax_mode: 'EXCLUDE' as 'EXCLUDE' | 'INCLUDE' | 'NON_PAJAK', // TAMBAHAN BARU
  });

  const [items, setItems] = useState<SPKItem[]>([
    { description: '', volume: 1, unit: 'ls', unit_price: 0 }
  ]);

  useEffect(() => {
    if (isOpen) {
      if (editingSPK) {
        setForm({
          subcontractor_id: editingSPK.subcontractor_id,
          spk_number: editingSPK.spk_number,
          work_description: editingSPK.work_description,
          retention_pct: editingSPK.retention_pct || 5,
          ppn_pct: editingSPK.ppn_pct ?? 11,
          pph_pct: editingSPK.pph_pct ?? 2,
          tax_mode: editingSPK.tax_mode || 'EXCLUDE', // TAMBAHAN BARU
        });
        setItems([{ description: 'Ubah nilai kontrak (Item lama disembunyikan saat edit)', volume: 1, unit: 'ls', unit_price: editingSPK.contract_value }]);
      } else {
        setForm({
          subcontractor_id: '',
          spk_number: '',
          work_description: '',
          retention_pct: 5,
          ppn_pct: 11,
          pph_pct: 2,
          tax_mode: 'EXCLUDE', // TAMBAHAN BARU
        });
        setItems([{ description: '', volume: 1, unit: 'ls', unit_price: 0 }]);
      }
    }
  }, [isOpen, editingSPK]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    if (isEditMode) return showToast('Hapus/Tambah item hanya bisa saat pembuatan SPK baru', 'error');
    setItems([...items, { description: '', volume: 1, unit: 'ls', unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (isEditMode) return;
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof SPKItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const totalValue = items.reduce((sum, item) => sum + (item.volume * item.unit_price), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subcontractor_id) {
      showToast('Pilih vendor subkon terlebih dahulu', 'error');
      return;
    }
    if (totalValue <= 0) {
      showToast('Total nilai SPK harus lebih dari 0', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && editingSPK) {
        await updateSPK(editingSPK.id, {
          subcontractor_id: form.subcontractor_id,
          spk_number: form.spk_number,
          work_description: form.work_description,
          retention_pct: form.retention_pct,
          ppn_pct: form.ppn_pct,
          pph_pct: form.pph_pct,
          tax_mode: form.tax_mode, // TAMBAHAN BARU
          contract_value: totalValue,
        });
        showToast('SPK berhasil diperbarui', 'success');
      } else {
        const spkData = await createSPK({
          ...form,
          project_id: projectId,
          contract_value: totalValue,
          status: 'Active',
        });

        const itemsPayload = items.map(item => ({
          contract_id: spkData.id,
          description: item.description,
          volume: item.volume,
          unit: item.unit,
          unit_price: item.unit_price,
        }));

        const { error: itemsError } = await supabase.from('subcontractor_spk_items').insert(itemsPayload);
        if (itemsError) throw itemsError;

        showToast('SPK & Item Pekerjaan berhasil dibuat', 'success');
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6">
        <h2 className="text-xl font-bold mb-4">{isEditMode ? 'Edit SPK' : 'Buat SPK Baru'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pilih Vendor Subkon</label>
              <select disabled={isEditMode} required value={form.subcontractor_id} onChange={e => setForm({...form, subcontractor_id: e.target.value})} className="w-full border rounded p-2 disabled:bg-slate-100">
                <option value="">-- Pilih Vendor --</option>
                {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nomor SPK</label>
              <input type="text" required placeholder="Cth: SPK/2026/001" value={form.spk_number} onChange={e => setForm({...form, spk_number: e.target.value})} className="w-full border rounded p-2" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Judul Lingkup Pekerjaan</label>
            <input type="text" required placeholder="Cth: Pekerjaan Struktur Baja" value={form.work_description} onChange={e => setForm({...form, work_description: e.target.value})} className="w-full border rounded p-2" />
          </div>

          <div className="grid grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border">
            {/* TAMBAHAN BARU: DROPDOWN MODE HARGA */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Mode Harga</label>
              <select required value={form.tax_mode} onChange={e => setForm({...form, tax_mode: e.target.value as any})} className="w-full border rounded p-2 text-sm font-bold text-teal-700">
                <option value="EXCLUDE">EXCLUDE PAJAK</option>
                <option value="INCLUDE">INCLUDE PAJAK</option>
                <option value="NON_PAJAK">NON PAJAK</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Retensi (%)</label>
              <input type="number" step="0.01" required value={form.retention_pct} onChange={e => setForm({...form, retention_pct: Number(e.target.value)})} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">PPN Default (%)</label>
              <input type="number" step="0.01" required value={form.ppn_pct} onChange={e => setForm({...form, ppn_pct: Number(e.target.value)})} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">PPh Default (%)</label>
              <input type="number" step="0.01" required value={form.pph_pct} onChange={e => setForm({...form, pph_pct: Number(e.target.value)})} className="w-full border rounded p-2 text-sm" />
            </div>
          </div>

          <div className="border-t pt-4 mt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-700">Rincian Item Pekerjaan (RAB)</h3>
              {!isEditMode && (
                <button type="button" onClick={handleAddItem} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-200 flex items-center gap-1 font-bold">
                  <Plus size={14}/> Tambah Baris
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-end bg-slate-50 p-3 rounded-lg border">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Uraian</label>
                    <input type="text" required value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Vol</label>
                    <input type="number" step="0.01" required value={item.volume} onChange={e => handleItemChange(index, 'volume', Number(e.target.value))} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Sat</label>
                    <input type="text" required value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value)} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                  <div className="w-36">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Harga Satuan</label>
                    <input type="number" step="0.01" required value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', Number(e.target.value))} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                  <div className="w-32 text-right pb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Subtotal</span>
                    <span className="text-sm font-bold text-slate-700">Rp {(item.volume * item.unit_price).toLocaleString('id-ID')}</span>
                  </div>
                  {!isEditMode && (
                    <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 mb-1 text-red-500 hover:bg-red-100 rounded">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <div className="bg-blue-50 px-5 py-3 rounded-lg border border-blue-200">
                <span className="text-sm font-medium text-slate-600 mr-3">Total Nilai SPK:</span>
                <span className="text-xl font-bold text-blue-700">Rp {totalValue.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 border-t pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold" disabled={loading}>
              {loading ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Simpan SPK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}