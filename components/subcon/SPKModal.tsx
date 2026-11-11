'use client';

import { useState, useEffect } from 'react';
import { createSPK, updateSPK } from '@/lib/services/subcon.service';
import { Subcontractor, SubcontractorContract } from '@/lib/types/subcon';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, FileSignature, UploadCloud, X, Info, Save, Loader2 } from 'lucide-react';
import { generateSpkNumber, roundSPK_Thousands } from '@/lib/utils/spk-helper';

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
  const [isUploading, setIsUploading] = useState(false);
  const isEditMode = !!editingSPK;

  const [form, setForm] = useState({
    subcontractor_id: '', spk_number: '', work_description: '', retention_pct: 5, ppn_pct: 11, pph_pct: 1.75,
    tax_mode: 'EXCLUDE' as 'EXCLUDE' | 'INCLUDE' | 'NON_PAJAK', signature_pihak_1: '', signature_pihak_1_title: 'KaDiv Infra',
    signature_pihak_2: '', signature_pihak_2_title: 'Mandor', ktp_url: '',
  });

  const [items, setItems] = useState<SPKItem[]>([{ description: '', volume: 1, unit: 'ls', unit_price: 0 }]);

  useEffect(() => {
    if (isOpen) {
      if (editingSPK) {
        setForm({
          subcontractor_id: editingSPK.subcontractor_id, spk_number: editingSPK.spk_number, work_description: editingSPK.work_description,
          retention_pct: editingSPK.retention_pct ?? 5, ppn_pct: editingSPK.ppn_pct ?? 11, pph_pct: editingSPK.pph_pct ?? 1.75,
          tax_mode: editingSPK.tax_mode || 'EXCLUDE', signature_pihak_1: editingSPK.signature_pihak_1 || '', signature_pihak_1_title: editingSPK.signature_pihak_1_title || 'KaDiv Infra',
          signature_pihak_2: editingSPK.signature_pihak_2 || '', signature_pihak_2_title: editingSPK.signature_pihak_2_title || 'Mandor', ktp_url: editingSPK.ktp_url || '',
        });
        setItems([{ description: 'Ubah nilai kontrak (Item lama disembunyikan)', volume: 1, unit: 'ls', unit_price: editingSPK.contract_value }]);
      } else {
        const autoNumber = generateSpkNumber('KL', 'BKP', 1, new Date());
        setForm({
          subcontractor_id: '', spk_number: autoNumber, work_description: '', retention_pct: 5, ppn_pct: 11, pph_pct: 1.75,
          tax_mode: 'EXCLUDE', signature_pihak_1: '', signature_pihak_1_title: 'KaDiv Infra', signature_pihak_2: '', signature_pihak_2_title: 'Mandor', ktp_url: '',
        });
        setItems([{ description: '', volume: 1, unit: 'ls', unit_price: 0 }]);
      }
    }
  }, [isOpen, editingSPK]);

  const handleVendorChange = (vendorId: string) => {
    const selectedVendor = subcontractors.find(v => v.id === vendorId);
    setForm({ ...form, subcontractor_id: vendorId, pph_pct: selectedVendor?.pph_rate ?? 1.75 });
  };

  const handleTaxModeChange = (mode: 'EXCLUDE' | 'INCLUDE' | 'NON_PAJAK') => {
    if (mode === 'NON_PAJAK') setForm({ ...form, tax_mode: mode, ppn_pct: 0, pph_pct: 0 });
    else setForm({ ...form, tax_mode: mode });
  };

  if (!isOpen) return null;

  const subtotalRAB = items.reduce((sum, item) => sum + (item.volume * item.unit_price), 0);
  let dpp = subtotalRAB;
  let ppnNominal = 0;

  if (form.tax_mode === 'INCLUDE') {
    dpp = subtotalRAB / (1 + (form.ppn_pct / 100));
    ppnNominal = subtotalRAB - dpp;
  } else if (form.tax_mode === 'EXCLUDE') {
    ppnNominal = subtotalRAB * (form.ppn_pct / 100);
  }

  const grandTotalAsli = dpp + ppnNominal;
  const totalValueBulat = roundSPK_Thousands(grandTotalAsli);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showToast('Ukuran file maksimal 2MB', 'error');
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('ktp_documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('ktp_documents').getPublicUrl(filePath);
      setForm({ ...form, ktp_url: publicUrlData.publicUrl });
      showToast('KTP berhasil diunggah', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return showToast('Tunggu proses upload KTP selesai', 'error');
    if (!form.subcontractor_id) return showToast('Pilih vendor subkon terlebih dahulu', 'error');
    if (totalValueBulat <= 0) return showToast('Total nilai SPK harus lebih dari 0', 'error');

    setLoading(true);
    try {
      if (isEditMode && editingSPK) {
        await updateSPK(editingSPK.id, { ...form, contract_value: totalValueBulat });
        showToast('SPK berhasil diperbarui', 'success');
      } else {
        const spkData = await createSPK({ ...form, project_id: projectId, contract_value: totalValueBulat, status: 'Active', bq_items: items });
        const itemsPayload = items.map(item => ({ contract_id: spkData.id, description: item.description, volume: item.volume, unit: item.unit, unit_price: item.unit_price }));
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSignature className="text-indigo-600" /> {isEditMode ? 'Edit SPK' : 'Buat SPK Baru'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 bg-white p-1.5 rounded-lg border border-slate-200 transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex gap-3 text-sm shadow-sm">
            <Info size={24} className="shrink-0 text-blue-600" />
            <div>
              <strong className="block mb-1">Panduan Akuntansi (SAK ETAP Bab 23 & KUP):</strong>
              <ul className="list-disc ml-4 mt-1 text-xs space-y-1 font-medium">
                <li>Pendapatan diakui berdasarkan persentase penyelesaian (Percentage of Completion).</li>
                <li>PPh Final (PP 9/2022) bersifat final dan langsung diakui sebagai Beban Pajak.</li>
                <li>Nilai Kontrak (Total SPK) adalah Nilai Invoice (DPP + PPN). PPh & Retensi adalah pemotongan saat pembayaran.</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pilih Vendor Subkon</label>
                <select disabled={isEditMode} required value={form.subcontractor_id} onChange={e => handleVendorChange(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 font-medium">
                  <option value="">-- Pilih Vendor --</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nomor SPK</label>
                <input type="text" required value={form.spk_number} onChange={e => setForm({...form, spk_number: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono font-bold" />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Judul Lingkup Pekerjaan</label>
              <input type="text" required value={form.work_description} onChange={e => setForm({...form, work_description: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium" />
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-5">
              <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2">Informasi Penandatangan & Lampiran</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Pihak 1</label><input type="text" value={form.signature_pihak_1} onChange={e => setForm({...form, signature_pihak_1: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Jabatan Pihak 1</label><input type="text" value={form.signature_pihak_1_title} onChange={e => setForm({...form, signature_pihak_1_title: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Pihak 2</label><input type="text" value={form.signature_pihak_2} onChange={e => setForm({...form, signature_pihak_2: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Jabatan Pihak 2</label><input type="text" value={form.signature_pihak_2_title} onChange={e => setForm({...form, signature_pihak_2_title: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500" /></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Foto KTP Mandor (Maks 2MB)</label>
                {form.ktp_url ? (
                  <div className="flex items-center gap-4 bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                    <img src={form.ktp_url} alt="Preview KTP" className="h-16 w-24 object-cover rounded-lg border" />
                    <div className="flex-1"><a href={form.ktp_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 hover:underline">Lihat File Penuh</a></div>
                    <button type="button" onClick={() => setForm({...form, ktp_url: ''})} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><X size={18} /></button>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center justify-center bg-white hover:bg-slate-50 transition-colors cursor-pointer group">
                    <input type="file" accept="image/jpeg, image/png" onChange={handleFileUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    {isUploading ? <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold"><div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> Mengunggah...</div> : <><UploadCloud size={24} className="text-slate-400 mb-2 group-hover:scale-110 transition-transform" /><span className="text-sm text-slate-600 font-bold">Klik untuk memilih foto KTP</span></>}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 relative z-10 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Mode Harga</label>
                <select required value={form.tax_mode} onChange={e => handleTaxModeChange(e.target.value as any)} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-teal-700 outline-none focus:border-teal-500">
                  <option value="EXCLUDE">EXCLUDE PAJAK</option>
                  <option value="INCLUDE">INCLUDE PAJAK</option>
                  <option value="NON_PAJAK">NON PAJAK</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Retensi (%)</label>
                <input type="number" step="0.01" required value={form.retention_pct} onChange={e => setForm({...form, retention_pct: Number(e.target.value)})} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 tabular-nums" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">PPN Default (%)</label>
                <input type="number" step="0.01" required value={form.ppn_pct} onChange={e => setForm({...form, ppn_pct: Number(e.target.value)})} disabled={form.tax_mode === 'NON_PAJAK'} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 tabular-nums disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">PPh Final (%)</label>
                <select required value={form.pph_pct} onChange={e => setForm({...form, pph_pct: Number(e.target.value)})} disabled={form.tax_mode === 'NON_PAJAK'} className="w-full border border-slate-300 rounded-lg p-2 text-sm text-indigo-700 font-bold outline-none focus:border-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                  <option value={1.75}>1.75% (Kecil)</option><option value={2.65}>2.65% (Menengah/Besar)</option><option value={3.50}>3.50% (Konsultan)</option><option value={4.00}>4.00% (Tanpa SBU)</option><option value={0}>0% (Tanpa PPh)</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800">Rincian Item Pekerjaan (RAB)</h3>
                {!isEditMode && (
                  <button type="button" onClick={() => setItems([...items, { description: '', volume: 1, unit: 'ls', unit_price: 0 }])} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1 font-bold transition-colors"><Plus size={14}/> Tambah Baris</button>
                )}
              </div>
              
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Uraian</label>
                      <input type="text" required value={item.description} onChange={e => { const newItems = [...items]; newItems[index].description = e.target.value; setItems(newItems); }} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-white" />
                    </div>
                    <div className="w-full md:w-24">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Vol</label>
                      <input type="number" step="0.01" required value={item.volume} onChange={e => { const newItems = [...items]; newItems[index].volume = Number(e.target.value); setItems(newItems); }} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-white tabular-nums" />
                    </div>
                    <div className="w-full md:w-20">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Sat</label>
                      <input type="text" required value={item.unit} onChange={e => { const newItems = [...items]; newItems[index].unit = e.target.value; setItems(newItems); }} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-white" />
                    </div>
                    <div className="w-full md:w-40">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Harga Satuan</label>
                      <input type="number" step="0.01" required value={item.unit_price} onChange={e => { const newItems = [...items]; newItems[index].unit_price = Number(e.target.value); setItems(newItems); }} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 bg-white tabular-nums" />
                    </div>
                    <div className="w-full md:w-36 text-right pb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Subtotal</span>
                      <span className="text-sm font-bold text-slate-800 tabular-nums">Rp {(item.volume * item.unit_price).toLocaleString('id-ID')}</span>
                    </div>
                    {!isEditMode && (
                      <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} className="p-2.5 mb-1 text-rose-500 hover:bg-rose-100 bg-rose-50 border border-rose-200 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col items-end gap-2 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <div className="flex justify-between w-full max-w-sm text-sm text-slate-600 font-medium"><span>Subtotal RAB (DPP jika Non/Exclude):</span><span className="tabular-nums">Rp {subtotalRAB.toLocaleString('id-ID')}</span></div>
                {form.tax_mode === 'INCLUDE' && <div className="flex justify-between w-full max-w-sm text-sm text-slate-600 font-medium"><span>DPP (Nilai Kontrak / 1.11):</span><span className="tabular-nums">Rp {dpp.toLocaleString('id-ID')}</span></div>}
                {form.tax_mode !== 'NON_PAJAK' && <div className="flex justify-between w-full max-w-sm text-sm text-teal-600 font-medium"><span>PPN ({form.ppn_pct}%):</span><span className="tabular-nums">Rp {ppnNominal.toLocaleString('id-ID')}</span></div>}
                <div className="flex justify-between w-full max-w-sm text-sm text-slate-400 font-medium"><span>Total Sebelum Pembulatan:</span><span className="line-through tabular-nums">Rp {grandTotalAsli.toLocaleString('id-ID')}</span></div>
                <div className="bg-indigo-600 px-5 py-3 rounded-xl shadow-md w-full max-w-sm flex justify-between items-center mt-2">
                  <span className="text-sm font-bold text-indigo-100">Total Nilai SPK (Grand Total):</span>
                  <span className="text-xl font-extrabold text-white tabular-nums">Rp {totalValueBulat.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 mt-6 bg-slate-50 p-4 rounded-b-2xl shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors">Batal</button>
              <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all" disabled={loading || isUploading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} {loading ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Simpan SPK'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}