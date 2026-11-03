'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ShieldCheck, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ApprovalsPage() {
  const [pendingFlows, setPendingFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // State untuk Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPending = async () => {
    setLoading(true);
    const { data } = await supabase.from('cash_flows').select('*').eq('approval_status', 'Pending').order('transaction_date', { ascending: false });
    if (data) setPendingFlows(data);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (id, status, reason = null) => {
    const payload = { approval_status: status };
    if (reason) payload.rejection_reason = reason;

    const { error } = await supabase.from('cash_flows').update(payload).eq('id', id);
    if (!error) {
      showToast('success', `Transaksi berhasil di-${status}!`);
      setIsRejectModalOpen(false);
      setRejectReason('');
      fetchPending();
    }
  };

  const confirmReject = () => {
    if (!rejectReason.trim()) return alert("Alasan penolakan wajib diisi!");
    handleAction(rejectId, 'Rejected', rejectReason);
  };

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

  if (loading) return <LoadingSpinner text="Memuat Dasbor Persetujuan..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle2 size={18} /> {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" /> Dasbor Persetujuan (Project Manager)
          </h1>
          <p className="text-sm text-slate-500 mt-1">Tinjau dan setujui pengajuan kas dari lapangan.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">WBS</th>
                <th className="p-3">Vendor/Ref</th>
                <th className="p-3 text-right">Nominal (Rp)</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingFlows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-500 italic">Tidak ada transaksi yang menunggu persetujuan.</td></tr>
              )}
              {pendingFlows.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-600 text-xs">{new Date(f.transaction_date).toLocaleDateString('id-ID')}</td>
                  <td className="p-3 text-xs font-semibold">{f.category}</td>
                  <td className="p-3 font-mono text-xs">{f.wbs_code || '-'}</td>
                  <td className="p-3 text-xs">{f.vendor_or_ref || '-'}</td>
                  <td className="p-3 text-right font-bold text-red-600">{formatRp(f.amount)}</td>
                  <td className="p-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => handleAction(f.id, 'Approved')} className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><ShieldCheck size={14}/> Approve</button>
                      <button onClick={() => { setRejectId(f.id); setIsRejectModalOpen(true); }} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><X size={14}/> Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ALASAN PENOLAKAN */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={18}/> Tolak Pengajuan</h2>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Silakan berikan alasan mengapa pengajuan kas ini ditolak agar tim lapangan dapat memperbaikinya.</p>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Alasan Penolakan <span className="text-red-500">*</span></label>
                <textarea 
                  required 
                  rows="3" 
                  value={rejectReason} 
                  onChange={e => setRejectReason(e.target.value)} 
                  placeholder="cth: Nota buram, volume tidak sesuai fisik, dll." 
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none" 
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Batal</button>
                <button onClick={confirmReject} className="px-6 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md">Tolak Transaksi</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}