'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useProject } from '../../context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import { invalidateCache } from '@/lib/utils/cache';
import { getMfaStatus, verifyTotpCode } from '@/lib/services/mfa.service';
import { recordAuditEvent } from '@/lib/services/logs.service';
import { ShieldCheck, X, CheckCircle2, AlertTriangle, Lock, KeyRound, Loader2 } from 'lucide-react';

export default function ApprovalsPage() {
  const { activeProjectId } = useProject();
  const { can, isApprover } = useRole(activeProjectId);

  const canApprove = can('APPROVE_FINANCE');

  const [pendingFlows, setPendingFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // State 2FA Approver
  const [mfaStatus, setMfaStatus] = useState(null);
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaOtp, setMfaOtp] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

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
    getMfaStatus().then(setMfaStatus).catch(() => {});
  }, [activeProjectId]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const executeApprovalUpdate = async (id, status, reason = null) => {
    if (!activeProjectId) return;
    const prevRow = pendingFlows.find((f) => f.id === id) || null;
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

    // Rekam ke Immutable Audit Log (mencatat IP, User-Agent, & snapshot Role)
    await recordAuditEvent({
      projectId: activeProjectId,
      tableName: 'cash_flows',
      action: status === 'Approved' ? 'APPROVE' : 'REJECT',
      recordId: id,
      oldData: prevRow ? { approval_status: prevRow.approval_status, amount: prevRow.amount } : null,
      newData: payload,
    });

    invalidateCache(`finances_${activeProjectId}`);
    showToast('success', `Transaksi berhasil di-${status}!`);
    setIsRejectModalOpen(false);
    setRejectReason('');
    fetchPending();
  };

  const handleAction = async (id, status, reason = null) => {
    if (!canApprove) {
      return showToast(
        'danger',
        'Akses ditolak: Hanya Owner, Super Admin, Finance Manager, atau Project Manager yang dapat menyetujui.'
      );
    }

    // Jika Approver telah mengaktifkan 2FA tetapi sesi masih AAL1, minta verifikasi OTP dulu
    if (mfaStatus?.needsChallenge && mfaStatus.verifiedFactors[0]?.id) {
      setPendingAction({ id, status, reason });
      setMfaOtp('');
      setMfaModalOpen(true);
      return;
    }

    await executeApprovalUpdate(id, status, reason);
  };

  const handleVerifyMfaAndProceed = async (e) => {
    e.preventDefault();
    const factorId = mfaStatus?.verifiedFactors?.[0]?.id;
    if (!factorId || !pendingAction) return;

    setVerifyingMfa(true);
    try {
      await verifyTotpCode(factorId, mfaOtp);
      const updated = await getMfaStatus();
      setMfaStatus(updated);
      setMfaModalOpen(false);
      await executeApprovalUpdate(pendingAction.id, pendingAction.status, pendingAction.reason);
      setPendingAction(null);
    } catch (err) {
      showToast('danger', err?.message || 'Verifikasi 2FA gagal.');
    } finally {
      setVerifyingMfa(false);
    }
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
              <ShieldCheck className="text-indigo-600" /> Dasbor Persetujuan (Approver)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Tinjau dan setujui pengajuan kas untuk proyek aktif (tercatat otomatis di Immutable Audit Log).
            </p>
          </div>
          {!canApprove && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Lock size={14} /> Mode Lihat Saja (Khusus Approver)
            </span>
          )}
        </div>

        {isApprover && mfaStatus && !mfaStatus.hasTotp && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-sm text-amber-900">
              <KeyRound className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <span>
                <strong>Keamanan Approver:</strong> Aktifkan <strong>2FA Authenticator (TOTP)</strong> untuk melindungi persetujuan keuangan sesuai standar Enterprise.
              </span>
            </div>
            <Link
              href="/settings/security"
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold text-center"
            >
              Aktifkan 2FA Sekarang
            </Link>
          </div>
        )}

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
                        <span className="text-xs text-slate-400 italic">Hanya Approver</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL VERIFIKASI 2FA TOTP APPROVER */}
      {mfaModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <form onSubmit={handleVerifyMfaAndProceed} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                <KeyRound size={22} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Verifikasi 2FA Approver</h3>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan 6 digit kode dari aplikasi Authenticator untuk menandatangani persetujuan ini.
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={mfaOtp}
              onChange={(e) => setMfaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full border border-slate-300 rounded-xl py-3 text-center font-mono text-2xl tracking-[0.4em] focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMfaModalOpen(false);
                  setPendingAction(null);
                }}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={verifyingMfa || mfaOtp.length !== 6}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifyingMfa ? <Loader2 className="animate-spin" size={16} /> : 'Verifikasi'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                Silakan berikan alasan mengapa pengajuan kas ini ditolak agar tim lapangan dapat memperbaikinya.
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
