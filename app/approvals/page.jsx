'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useProject } from '../../context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import { invalidateCache } from '@/lib/utils/cache';
import { ShieldCheck, X, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';

export default function ApprovalsPage() {
  const { activeProjectId, userRole } = useProject();
  const { role } = useRole(activeProjectId);

  const normalizedRole = (role || userRole || '').toLowerCase().trim();
  const canApprove =
    normalizedRole === 'owner' ||
    normalizedRole === 'pm' ||
    normalizedRole === 'project manager';

  const [pendingFlows, setPendingFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // State untuk Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPending = async () => {
    if (!activeProjectId) {
      setPendingFlows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('cash_flows')
      .select('*')
      .eq('project_id', activeProjectId)
      .in('approval_status', ['Pending', 'Pending Overbudget'])
      .eq('is_deleted', false)
      .is('voided_at', null)
      .order('transaction_date', { ascending: false });

    if (error) {
      showToast('danger', 'Gagal memuat pengajuan: ' + error.message);
    } else {
      setPendingFlows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, [activeProjectId]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (id, status, reason = null) => {
    if (!canApprove) {
      return showToast('danger', 'Akses ditolak: Hanya Owner atau Project Manager yang dapat menyetujui/menolak.');
    }
    if (!activeProjectId) return;

    const payload = { approval_status: status };
    if (reason) payload.rejection_reason = reason;

    const { error } = await supabase
      .from('cash_flows')
      .update(payload)
      .eq('id', id)
      .eq('project_id', activeProjectId);

    if (error) {
      showToast('danger', 'Gagal memproses persetujuan: ' + error.message);
      return;
    }

    invalidateCache(`finances_${activeProjectId}`);
    showToast('success', `Transaksi berhasil di-${status}!`);
    setIsRejectModalOpen(false);
    setRejectReason('');
    fetchPending();
  };

  const confirmReject = () => {
    if (!rejectReason.trim()) return showToast('danger', 'Alasan penolakan wajib diisi!');
    handleAction(rejectId, 'Rejected', rejectReason);
  };

  const formatRp = (num) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num || 0);

  if (loading) return <LoadingSpinner text="Memuat Dasbor Persetujuan..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <CheckCircle2 size={18} /> {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-indigo-600" /> Dasbor Persetujuan (Project Manager)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Tinjau dan setujui pengajuan kas untuk proyek aktif.
            </p>
          </div>
          {!canApprove && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Lock size={14} /> Mode Lihat Saja (Khusus Owner / PM)
            </span>
          )}
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
              {!activeProjectId ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500 italic">
                    Pilih proyek aktif terlebih dahulu untuk meninjau persetujuan.
                  </td>
                </tr>
              ) : pendingFlows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500 italic">
                    Tidak ada transaksi yang menunggu persetujuan pada proyek ini.
                  </td>
                </tr>
              ) : (
                pendingFlows.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600 text-xs">
                      {new Date(f.transaction_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="p-3 text-xs font-semibold">
                      {f.category}
                      {f.approval_status === 'Pending Overbudget' && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold">
                          OVERBUDGET
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{f.wbs_code || '-'}</td>
                    <td className="p-3 text-xs">{f.vendor_or_ref || f.description || '-'}</td>
                    <td className="p-3 text-right font-bold text-red-600">{formatRp(f.amount)}</td>
                    <td className="p-3 text-center">
                      {canApprove ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleAction(f.id, 'Approved')}
                            className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"
                          >
                            <ShieldCheck size={14} /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectId(f.id);
                              setIsRejectModalOpen(true);
                            }}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Hanya PM/Owner</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ALASAN PENOLAKAN */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle size={18} /> Tolak Pengajuan
              </h2>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Silakan berikan alasan mengapa pengajuan kas ini ditolak agar tim lapangan dapat
                memperbaikinya.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows="3"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="cth: Nota buram, volume tidak sesuai fisik, dll."
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={confirmReject}
                  className="px-6 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md"
                >
                  Tolak Transaksi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
