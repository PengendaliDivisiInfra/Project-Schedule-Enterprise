'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ShieldCheck, X, FileText, CheckCircle2 } from 'lucide-react';

export default function ApprovalsPage() {
  const [pendingFlows, setPendingFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

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

  const handleAction = async (id, status) => {
    const { error } = await supabase.from('cash_flows').update({ approval_status: status }).eq('id', id);
    if (!error) {
      showToast('success', `Transaksi berhasil di-${status}!`);
      fetchPending();
    }
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
                      <button onClick={() => handleAction(f.id, 'Rejected')} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><X size={14}/> Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}