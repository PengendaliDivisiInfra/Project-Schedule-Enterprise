'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Save, Landmark } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  terminData: any; // Data termin yang dipilih
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function InputPencairanModal({ isOpen, onClose, terminData, onSuccess, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  
  // State Form Input Pencairan
  const [form, setForm] = useState({
    sp2d_number: '',
    spm_number: '',
    ntpn_number: '',
    // Nilai potongan (bisa auto-fill dari terminData jika ada)
    potongan_dp: terminData?.potongan_dp || 0,
    nilai_ppn: terminData?.nilai_ppn || 0,
    nilai_pph: terminData?.nilai_pph || 0,
  });

  if (!isOpen || !terminData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Update tabel project_termins dengan data SP2D
      // Ini akan otomatis memicu Trigger generate_gl_on_sp2d di database
      const { error } = await supabase
        .from('project_termins')
        .update({
          sp2d_number: form.sp2d_number,
          spm_number: form.spm_number,
          ntpn_number: form.ntpn_number,
          potongan_dp: form.potongan_dp,
          nilai_ppn: form.nilai_ppn,
          nilai_pph: form.nilai_pph,
          // status: 'Paid' // Opsional: jika ada kolom status
        })
        .eq('id', terminData.id);

      if (error) throw error;

      showToast('Pencairan (SP2D) berhasil dicatat. Jurnal GL otomatis terbentuk!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        
        {/* HEADER MODAL */}
        <div className="bg-indigo-600 p-5 text-white flex items-center gap-3">
          <Landmark size={24} />
          <div>
            <h2 className="text-lg font-bold">Input Pencairan SP2D</h2>
            <p className="text-indigo-100 text-xs">Termin {terminData.termin_no} - {terminData.name}</p>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 mb-4">
            <strong>Penting:</strong> Mengisi form ini akan otomatis membuat Jurnal Umum (General Ledger) untuk Kas Masuk, Piutang Retensi, dan Beban Pajak.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">No. SP2D (Wajib)</label>
              <input type="text" required placeholder="Cth: 001/SP2D/2026" value={form.sp2d_number} onChange={e => setForm({...form, sp2d_number: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">No. SPM</label>
              <input type="text" placeholder="No. Surat Perintah Membayar" value={form.spm_number} onChange={e => setForm({...form, spm_number: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">NTPN (Bukti Setor Pajak)</label>
            <input type="text" placeholder="Nomor Tanda Penerimaan Negara" value={form.ntpn_number} onChange={e => setForm({...form, ntpn_number: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          {/* NILAI POTONGAN WAPU */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 mt-4">
            <h4 className="font-bold text-slate-700 text-sm border-b pb-2">Potongan Bendahara (Wapu)</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Potongan DP (Rp)</label>
                <input type="number" value={form.potongan_dp} onChange={e => setForm({...form, potongan_dp: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">PPh 4(2) (Rp)</label>
                <input type="number" value={form.nilai_pph} onChange={e => setForm({...form, nilai_pph: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">PPN Keluaran (Rp)</label>
              <input type="number" value={form.nilai_ppn} onChange={e => setForm({...form, nilai_ppn: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 transition-colors">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
              Simpan & Buat Jurnal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}