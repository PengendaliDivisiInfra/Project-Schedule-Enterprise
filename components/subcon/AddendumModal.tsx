'use client';

import { useState, useEffect } from 'react';
import { createAddendum, getSPKItems } from '@/lib/services/subcon.service';
import { AddendumItemChange } from '@/lib/types/subcon';
import { Plus, Trash2, Save, Info } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  spk: any;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function AddendumModal({ isOpen, onClose, spk, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  
  const [originalItems, setOriginalItems] = useState<AddendumItemChange[]>([]);
  
  const [form, setForm] = useState({
    addendum_no: 1,
    title: '',
    description: '',
    amount: 0,
    new_contract_value: 0,
    tax_mode: 'EXCLUDE' as 'EXCLUDE' | 'INCLUDE' | 'NON_PAJAK', // TAMBAHAN BARU
  });

  const [items, setItems] = useState<AddendumItemChange[]>([]);

  useEffect(() => {
    if (isOpen && spk) {
      const oldValue = spk.final_contract_value || spk.contract_value;
      
      setForm({
        addendum_no: 1,
        title: '',
        description: '',
        amount: 0,
        new_contract_value: oldValue,
        tax_mode: spk.tax_mode || 'EXCLUDE', // TAMBAHAN BARU
      });

      setLoadingItems(true);
      getSPKItems(spk.id).then(data => {
        let fetchedItems: AddendumItemChange[] = [];
        
        if (data && data.length > 0) {
          fetchedItems = data.map((i: any) => ({
            id: i.id,
            action: 'UPDATE' as const,
            description: i.description,
            volume: Number(i.volume),
            unit: i.unit,
            unit_price: Number(i.unit_price)
          }));
        } else {
          fetchedItems = [{
            id: `temp_${Date.now()}`, 
            action: 'UPDATE' as const,
            description: 'Nilai Kontrak Awal (Belum ada rincian)',
            volume: 1,
            unit: 'ls',
            unit_price: oldValue
          }];
        }
        
        setOriginalItems(JSON.parse(JSON.stringify(fetchedItems))); 
        setItems(fetchedItems);
        setLoadingItems(false);
      });
    }
  }, [isOpen, spk]);

  const oldContractValue = spk?.final_contract_value || spk?.contract_value || 0;
  
  const currentItemsTotal = items
    .filter(i => i.action !== 'DELETE')
    .reduce((sum, item) => sum + (item.volume * item.unit_price), 0);

  const amountDiff = currentItemsTotal - oldContractValue;

  useEffect(() => {
    if (loadingItems) return;

    const changes: string[] = [];

    items.forEach((item, index) => {
      if (item.action === 'ADD') {
        changes.push(`[TAMBAH] ${item.description} (${item.volume} ${item.unit})`);
      } else if (item.action === 'DELETE') {
        changes.push(`[HAPUS] ${item.description}`);
      } else {
        const orig = item.id && !item.id.startsWith('temp_') 
          ? originalItems.find(o => o.id === item.id)
          : originalItems[index]; 

        if (orig) {
          const volChanged = Number(orig.volume) !== Number(item.volume);
          const priceChanged = Number(orig.unit_price) !== Number(item.unit_price);
          const nameChanged = orig.description !== item.description;

          if (volChanged || priceChanged || nameChanged) {
            let detail = `[UBAH] ${orig.description}`;
            if (nameChanged) detail += ` menjadi ${item.description}`;
            if (volChanged) detail += ` | Vol: ${orig.volume} -> ${item.volume}`;
            if (priceChanged) detail += ` | Harga berubah`;
            changes.push(detail);
          }
        }
      }
    });

    setForm(prev => ({
      ...prev,
      description: changes.join('\n'),
      new_contract_value: currentItemsTotal
    }));
  }, [items, originalItems, loadingItems, currentItemsTotal]);

  if (!isOpen || !spk) return null;

  const handleItemChange = (index: number, field: keyof AddendumItemChange, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { action: 'ADD', description: '', volume: 1, unit: 'ls', unit_price: 0 }]);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = [...items];
    if (newItems[index].action === 'ADD') {
      newItems.splice(index, 1);
    } else {
      newItems[index].action = 'DELETE';
    }
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sanitizedItems = items
        .filter(i => i.action !== 'DELETE' || i.id) 
        .map(item => {
          if (item.id && item.id.startsWith('temp_')) {
            return { ...item, action: 'ADD' as const, id: undefined };
          }
          return item;
        })
        .filter(i => i.action === 'ADD' || i.action === 'DELETE' || i.volume !== 0);

      await createAddendum({
        contract_id: spk.id,
        addendum_no: form.addendum_no,
        title: form.title,
        description: form.description,
        amount: amountDiff,
        new_contract_value: form.new_contract_value,
        tax_mode: form.tax_mode, // TAMBAHAN BARU
        items: sanitizedItems
      });

      showToast('Addendum berhasil disimpan', 'success');
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-6">
        <h2 className="text-xl font-bold mb-2">Tambah Addendum (CCO)</h2>
        <p className="text-sm text-slate-500 mb-4">SPK: {spk.spk_number} - {spk.subcontractor_name}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">No. Addendum</label>
                <input type="number" required min={1} value={form.addendum_no} onChange={e => setForm({...form, addendum_no: Number(e.target.value)})} className="w-full border rounded p-2" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Judul Addendum</label>
                <input type="text" required placeholder="Cth: Pekerjaan Tambah / CCO 1" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full border rounded p-2" />
              </div>
              {/* TAMBAHAN BARU: DROPDOWN MODE HARGA DI ADDENDUM */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ubah Mode Harga</label>
                <select required value={form.tax_mode} onChange={e => setForm({...form, tax_mode: e.target.value as any})} className="w-full border rounded p-2 text-sm font-bold text-teal-700">
                  <option value="EXCLUDE">EXCLUDE PAJAK</option>
                  <option value="INCLUDE">INCLUDE PAJAK</option>
                  <option value="NON_PAJAK">NON PAJAK</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nilai Kontrak Lama</label>
                <div className="w-full border border-slate-200 bg-slate-100 rounded p-2 font-bold text-slate-600">
                  Rp {oldContractValue.toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nilai Kontrak Baru (Otomatis)</label>
                <div className="w-full border border-green-300 bg-green-50 rounded p-2 font-bold text-green-700 flex justify-between items-center">
                  <span>Rp {form.new_contract_value.toLocaleString('id-ID')}</span>
                  <span className={`text-xs px-2 py-1 rounded ${amountDiff >= 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                    {amountDiff >= 0 ? '+' : ''} {amountDiff.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                Keterangan Lengkap 
                <span title="Otomatis terisi berdasarkan perubahan RAB di bawah">
                  <Info size={14} className="text-blue-500 cursor-help" />
                </span>
              </label>
              <textarea 
                rows={3}
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                className="w-full border rounded p-2 text-sm bg-amber-50 text-amber-900"
                placeholder="Akan terisi otomatis jika ada perubahan item..."
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-700">Rincian Item Pekerjaan (RAB)</h3>
              <button type="button" onClick={handleAddItem} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-200 flex items-center gap-1 font-bold">
                <Plus size={14}/> Tambah Item Baru
              </button>
            </div>
            
            <div className="space-y-3">
              {loadingItems ? (
                <p className="text-center text-slate-500 py-4">Memuat item...</p>
              ) : items.map((item, index) => {
                if (item.action === 'DELETE') return null;
                
                return (
                  <div key={index} className={`flex gap-3 items-end p-3 rounded-lg border shadow-sm ${item.action === 'ADD' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Uraian {item.action === 'ADD' && <span className="text-green-600">(Baru)</span>}</label>
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
                    <button type="button" onClick={() => handleDeleteItem(index)} className="p-2 mb-1 text-red-500 hover:bg-red-100 rounded" title="Hapus Item">
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t mt-6">
            <div className="text-sm">
               Total RAB (Setelah Perubahan): <span className="font-bold text-blue-700 text-lg ml-2">Rp {currentItemsTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={loading}>Batal</button>
              <button type="submit" className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold flex items-center gap-2" disabled={loading}>
                <Save size={16} /> {loading ? 'Menyimpan...' : 'Simpan Addendum'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}