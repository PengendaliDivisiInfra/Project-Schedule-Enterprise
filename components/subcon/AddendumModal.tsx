'use client';

import { useState, useEffect } from 'react';
import { createAddendum, getSPKItems } from '@/lib/services/subcon.service';
import { AddendumItemChange } from '@/lib/types/subcon';
import { Plus, Trash2, Save, Info, Loader2, FileSignature, X } from 'lucide-react';

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
    tax_mode: 'EXCLUDE' as 'EXCLUDE' | 'INCLUDE' | 'NON_PAJAK',
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
        tax_mode: spk.tax_mode || 'EXCLUDE',
      });

      setLoadingItems(true);
      getSPKItems(spk.id).then(data => {
        let fetchedItems: AddendumItemChange[] = [];
        
        if (data && data.length > 0) {
          fetchedItems = data.map((i: any) => ({
            id: i.id, action: 'UPDATE' as const, description: i.description,
            volume: Number(i.volume), unit: i.unit, unit_price: Number(i.unit_price)
          }));
        } else {
          fetchedItems = [{ id: `temp_${Date.now()}`, action: 'UPDATE' as const, description: 'Nilai Kontrak Awal (Belum ada rincian)', volume: 1, unit: 'ls', unit_price: oldValue }];
        }
        
        setOriginalItems(JSON.parse(JSON.stringify(fetchedItems))); 
        setItems(fetchedItems);
        setLoadingItems(false);
      });
    }
  }, [isOpen, spk]);

  const oldContractValue = spk?.final_contract_value || spk?.contract_value || 0;
  const currentItemsTotal = items.filter(i => i.action !== 'DELETE').reduce((sum, item) => sum + (item.volume * item.unit_price), 0);
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
        const orig = item.id && !item.id.startsWith('temp_') ? originalItems.find(o => o.id === item.id) : originalItems[index]; 

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

    setForm(prev => ({ ...prev, description: changes.join('\n'), new_contract_value: currentItemsTotal }));
  }, [items, originalItems, loadingItems, currentItemsTotal]);

  if (!isOpen || !spk) return null;

  const handleItemChange = (index: number, field: keyof AddendumItemChange, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => setItems([...items, { action: 'ADD', description: '', volume: 1, unit: 'ls', unit_price: 0 }]);
  
  const handleDeleteItem = (index: number) => {
    const newItems = [...items];
    if (newItems[index].action === 'ADD') newItems.splice(index, 1);
    else newItems[index].action = 'DELETE';
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sanitizedItems = items
        .filter(i => i.action !== 'DELETE' || i.id) 
        .map(item => {
          if (item.id && item.id.startsWith('temp_')) return { ...item, action: 'ADD' as const, id: undefined };
          return item;
        })
        .filter(i => i.action === 'ADD' || i.action === 'DELETE' || i.volume !== 0);

      await createAddendum({
        contract_id: spk.id, addendum_no: form.addendum_no, title: form.title, description: form.description,
        amount: amountDiff, new_contract_value: form.new_contract_value, tax_mode: form.tax_mode, items: sanitizedItems
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSignature className="text-amber-600" /> Tambah Addendum (CCO)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 bg-white p-1.5 rounded-lg border border-slate-200 transition-colors"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 mb-5 text-sm font-medium flex items-center gap-2">
            <Info size={18} /> SPK: <span className="font-bold">{spk.spk_number} - {spk.subcontractor_name}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">No. Addendum</label>
                  <input type="number" required min={1} value={form.addendum_no} onChange={e => setForm({...form, addendum_no: Number(e.target.value)})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Judul Addendum</label>
                  <input type="text" required placeholder="Cth: Pekerjaan Tambah / CCO 1" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Ubah Mode Harga</label>
                  <select required value={form.tax_mode} onChange={e => setForm({...form, tax_mode: e.target.value as any})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-teal-700 outline-none focus:border-indigo-500 bg-white">
                    <option value="EXCLUDE">EXCLUDE PAJAK</option>
                    <option value="INCLUDE">INCLUDE PAJAK</option>
                    <option value="NON_PAJAK">NON PAJAK</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 border-t border-slate-200 pt-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nilai Kontrak Lama</label>
                  <div className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 font-bold text-slate-600 tabular-nums">
                    Rp {oldContractValue.toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nilai Kontrak Baru (Otomatis)</label>
                  <div className="w-full border border-emerald-300 bg-emerald-50 rounded-xl p-2.5 font-bold text-emerald-700 flex justify-between items-center shadow-sm tabular-nums">
                    <span>Rp {form.new_contract_value.toLocaleString('id-ID')}</span>
                    <span className={`text-[10px] px-2 py-1 rounded-lg border ${amountDiff >= 0 ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : 'bg-rose-100 border-rose-200 text-rose-800'}`}>
                      {amountDiff >= 0 ? '+' : ''} {amountDiff.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  Keterangan Lengkap <span title="Otomatis terisi berdasarkan perubahan RAB di bawah"><Info size={14} className="text-indigo-500 cursor-help" /></span>
                </label>
                <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-amber-50 text-amber-900 outline-none focus:border-indigo-500 font-medium" placeholder="Akan terisi otomatis jika ada perubahan item..." />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 text-lg">Rincian Item Pekerjaan (RAB)</h3>
                <button type="button" onClick={handleAddItem} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-100 flex items-center gap-1 font-bold transition-colors border border-indigo-200 shadow-sm">
                  <Plus size={14}/> Tambah Item Baru
                </button>
              </div>
              
              <div className="space-y-3">
                {loadingItems ? (
                  <p className="text-center text-slate-500 py-6 font-bold">Memuat item...</p>
                ) : items.map((item, index) => {
                  if (item.action === 'DELETE') return null;
                  return (
                    <div key={index} className={`flex flex-col md:flex-row gap-3 items-end p-4 rounded-xl border shadow-sm relative ${item.action === 'ADD' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex-1 w-full">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Uraian {item.action === 'ADD' && <span className="text-emerald-600">(Baru)</span>}</label>
                        <input type="text" required value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-white" />
                      </div>
                      <div className="w-full md:w-24">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Vol</label>
                        <input type="number" step="0.01" required value={item.volume} onChange={e => handleItemChange(index, 'volume', Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-white tabular-nums" />
                      </div>
                      <div className="w-full md:w-20">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Sat</label>
                        <input type="text" required value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-white" />
                      </div>
                      <div className="w-full md:w-40">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Harga Satuan</label>
                        <input type="number" step="0.01" required value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-white tabular-nums" />
                      </div>
                      <div className="w-full md:w-36 text-right pb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Subtotal</span>
                        <span className="text-sm font-bold text-slate-800 tabular-nums">Rp {(item.volume * item.unit_price).toLocaleString('id-ID')}</span>
                      </div>
                      <button type="button" onClick={() => handleDeleteItem(index)} className="p-2.5 mb-1 text-rose-500 hover:bg-rose-100 bg-rose-50 border border-rose-200 rounded-lg transition-colors" title="Hapus Item">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center pt-5 border-t border-slate-200 mt-6 bg-slate-50 p-4 rounded-xl shrink-0">
              <div className="text-sm font-bold text-slate-600 mb-3 md:mb-0">
                 Total RAB (Setelah Perubahan): <span className="text-indigo-700 text-lg ml-2 tabular-nums">Rp {currentItemsTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button type="button" onClick={onClose} className="flex-1 md:flex-none justify-center px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-200 transition-colors" disabled={loading}>Batal</button>
                <button type="submit" className="flex-1 md:flex-none justify-center px-6 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all" disabled={loading}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {loading ? 'Menyimpan...' : 'Simpan Addendum'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}