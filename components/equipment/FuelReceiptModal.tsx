"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { recordFuelReceipt } from '@/lib/services/inventory-service';
import { X, CheckCircle, AlertCircle, Fuel } from 'lucide-react';

export function FuelReceiptModal({ 
  isOpen, onClose, poId, poNumber, projectId, onSuccess 
}: { 
  isOpen: boolean; onClose: () => void; poId: string; poNumber: string; projectId: string; onSuccess: () => void; 
}) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [sealTop, setSealTop] = useState('');
  const [sealBottom, setSealBottom] = useState('');
  const [volume, setVolume] = useState('');
  
  const [solarHsdId, setSolarHsdId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSolarId = async () => {
      // Mencari ID Material Solar/Bahan Bakar di master_hsd
      const { data } = await supabase.from('master_hsd').select('id').ilike('nama_item', '%Solar%').limit(1).maybeSingle();
      if (data) setSolarHsdId(data.id);
    };
    if (isOpen) fetchSolarId();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solarHsdId) return alert("Master Material 'Solar' tidak ditemukan di database. Harap tambahkan di menu HSD.");
    
    setLoading(true);
    try {
      await recordFuelReceipt(
        projectId, solarHsdId, poId, poNumber, 
        receiptDate, deliveryNote, licensePlate, sealTop, sealBottom, Number(volume)
      );
      
      setToast({ show: true, msg: 'Penerimaan BBM berhasil dicatat ke Buku Besar!', type: 'success' });
      setTimeout(() => {
        onSuccess();
        onClose();
        setToast({ show: false, msg: '', type: 'success' });
      }, 1500);
    } catch (err: any) {
      setToast({ show: true, msg: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <span className="font-semibold text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
        <div className="flex justify-between items-center px-6 py-4 border-b bg-blue-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Fuel className="w-5 h-5 text-blue-600" /> Terima BBM (PO: {poNumber})</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-white/50 p-2 rounded-full"><X className="w-5 h-5"/></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Penerimaan *</label>
                <input type="date" required value={receiptDate} onChange={e => setReceiptDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Volume Diterima (Liter) *</label>
                <input type="number" step="0.01" required value={volume} onChange={e => setVolume(e.target.value)} className="w-full px-3 py-2 border rounded-md text-lg font-mono font-bold focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">No. Surat Jalan (SJ) *</label>
              <input type="text" required value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Contoh: SJ-8899" />
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nopol Truk</label>
                <input type="text" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm uppercase outline-none" placeholder="DD 1234 XY" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Segel Atas</label>
                <input type="text" value={sealTop} onChange={e => setSealTop(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm outline-none" placeholder="Angka" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Segel Bawah</label>
                <input type="text" value={sealBottom} onChange={e => setSealBottom(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm outline-none" placeholder="Angka" />
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border rounded-md">Batal</button>
            <button type="submit" disabled={loading || !solarHsdId} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50">
              {loading ? 'Memproses...' : 'Simpan & Masukkan ke Buku Besar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}