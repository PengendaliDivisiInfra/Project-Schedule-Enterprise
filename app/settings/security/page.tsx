'use client';

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Smartphone,
  CheckCircle2,
  Loader2,
  Trash2,
  Copy,
  Lock,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import {
  getMfaStatus,
  enrollTotp,
  verifyTotpCode,
  unenrollTotp,
  type MfaStatus,
} from '@/lib/services/mfa.service';
import { recordAuditEvent } from '@/lib/services/logs.service';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function SecuritySettingsPage() {
  const { activeProjectId } = useProject();
  const { role, globalRole, projectRole, isApprover, loading: roleLoading } = useRole(activeProjectId || undefined);

  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [pendingEnroll, setPendingEnroll] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [disableTargetId, setDisableTargetId] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  const emitToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message } }));
    }
  };

  const loadMfaStatus = async () => {
    setLoading(true);
    try {
      const status = await getMfaStatus();
      setMfa(status);
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memuat status keamanan 2FA.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMfaStatus();
  }, []);

  const handleStartEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await enrollTotp('InfraControl PRO Authenticator');
      setPendingEnroll({
        factorId: res.factorId,
        qrCode: res.qrCode,
        secret: res.secret,
      });
      setOtpCode('');
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal membuat QR Code 2FA.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEnroll) return;
    setVerifying(true);
    try {
      await verifyTotpCode(pendingEnroll.factorId, otpCode);
      await recordAuditEvent({
        projectId: activeProjectId,
        tableName: 'auth.mfa_factors',
        action: 'MFA_ENROLL',
        recordId: pendingEnroll.factorId,
        newData: { factor_type: 'totp', status: 'verified' },
      });
      emitToast('success', '2FA TOTP Authenticator berhasil diaktifkan!');
      setPendingEnroll(null);
      setOtpCode('');
      await loadMfaStatus();
    } catch (err: any) {
      emitToast('error', err?.message || 'Verifikasi kode 2FA gagal.');
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmDisable = async () => {
    if (!disableTargetId) return;
    setDisabling(true);
    try {
      await unenrollTotp(disableTargetId);
      await recordAuditEvent({
        projectId: activeProjectId,
        tableName: 'auth.mfa_factors',
        action: 'MFA_DISABLE',
        recordId: disableTargetId,
        oldData: { factor_type: 'totp', status: 'verified' },
      });
      emitToast('info', '2FA TOTP telah dinonaktifkan.');
      setDisableTargetId(null);
      await loadMfaStatus();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menonaktifkan 2FA.');
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = () => {
    if (!pendingEnroll?.secret) return;
    navigator.clipboard?.writeText(pendingEnroll.secret);
    emitToast('info', 'Kunci rahasia 2FA disalin ke clipboard.');
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <KeyRound className="text-indigo-600" /> Keamanan Akun &amp; 2FA (TOTP)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Autentikasi dua faktor (Google Authenticator / Microsoft Authenticator) untuk melindungi persetujuan keuangan &amp; pengadaan.
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase shrink-0 ${
              mfa?.hasTotp
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
            }`}
          >
            {mfa?.hasTotp ? '2FA Aktif (AAL2)' : 'Belum Aktif (AAL1)'}
          </span>
        </div>

        {/* Ringkasan Hybrid RBAC */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-bold uppercase text-slate-400">Global Role</p>
            <p className="text-sm font-bold text-slate-800 mt-1">{globalRole || 'User (Standar)'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-bold uppercase text-slate-400">Project Role Aktif</p>
            <p className="text-sm font-bold text-slate-800 mt-1">{projectRole || role || '-'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-bold uppercase text-slate-400">Kebijakan 2FA Approver</p>
            <p className="text-sm font-bold mt-1 text-indigo-700">
              {isApprover ? 'Wajib 2FA (Approver)' : 'Opsional (Disarankan)'}
            </p>
          </div>
        </div>

        {isApprover && !mfa?.hasTotp && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-start gap-3">
            <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-bold">Wajib Aktivasi 2FA untuk Approver</p>
              <p className="text-amber-800 mt-0.5">
                Peran Anda memiliki kewenangan persetujuan keuangan/pengadaan. Aktifkan 2FA TOTP di bawah ini agar aksi Approve/Reject selalu terverifikasi aman.
              </p>
            </div>
          </div>
        )}

        {/* Kartu Manajemen TOTP */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Smartphone size={22} />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Aplikasi Authenticator (TOTP)</h2>
                <p className="text-xs text-slate-500">
                  Kompatibel dengan Google Authenticator, Microsoft Authenticator, dan Authy.
                </p>
              </div>
            </div>

            {!mfa?.hasTotp && !pendingEnroll && (
              <button
                onClick={handleStartEnroll}
                disabled={enrolling}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {enrolling ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
                Aktifkan 2FA
              </button>
            )}
          </div>

          {/* Daftar Faktor Aktif */}
          {mfa?.hasTotp && (
            <div className="space-y-3">
              {mfa.verifiedFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-emerald-50/70 border border-emerald-200"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-emerald-600" size={20} />
                    <div>
                      <p className="font-bold text-sm text-slate-800">
                        {factor.friendly_name || 'Authenticator App (TOTP)'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Status: Terverifikasi • Level Sesi Saat Ini:{' '}
                        <span className="font-mono font-bold uppercase text-emerald-700">
                          {mfa.currentLevel}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDisableTargetId(factor.id)}
                    className="text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-rose-200"
                  >
                    <Trash2 size={14} /> Nonaktifkan
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form Pendaftaran QR Code Baru */}
          {pendingEnroll && (
            <form onSubmit={handleVerifyEnroll} className="space-y-5 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
                  <img
                    src={pendingEnroll.qrCode}
                    alt="QR Code 2FA TOTP"
                    className="w-44 h-44 object-contain"
                  />
                </div>
                <div className="space-y-3 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    1. Pindai QR Code dengan aplikasi Authenticator
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Jika tidak bisa memindai QR, masukkan kunci manual berikut di aplikasi Authenticator Anda:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono text-slate-800 break-all">
                      {pendingEnroll.secret}
                    </code>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600"
                      title="Salin kunci"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  2. Masukkan 6 Digit Kode OTP dari Aplikasi Authenticator
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="flex-1 border border-slate-300 bg-white rounded-xl px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={verifying || otpCode.length !== 6}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {verifying ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                    Verifikasi &amp; Aktifkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingEnroll(null)}
                    className="px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-white"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(disableTargetId)}
        title="Nonaktifkan 2FA TOTP?"
        message="Menonaktifkan 2FA akan menurunkan level keamanan akun Anda ke AAL1. Approver disarankan tetap mengaktifkan 2FA."
        confirmText="Ya, Nonaktifkan"
        variant="danger"
        loading={disabling}
        onConfirm={handleConfirmDisable}
        onCancel={() => setDisableTargetId(null)}
      />
    </div>
  );
}
