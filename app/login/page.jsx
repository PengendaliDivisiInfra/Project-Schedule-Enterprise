'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { getMfaStatus, verifyTotpCode } from '@/lib/services/mfa.service';
import { Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // State 2FA TOTP Challenge
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      setErrorMsg('Sesi Anda telah berakhir atau terjadi kesalahan autentikasi. Silakan login kembali.');

      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/login');
      }

      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type: 'error', message: 'Sesi berakhir. Silakan login ulang.' },
        })
      );
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Periksa apakah akun memiliki 2FA TOTP aktif dan perlu tantangan AAL2
      const mfaStatus = await getMfaStatus();
      if (mfaStatus.needsChallenge && mfaStatus.verifiedFactors[0]?.id) {
        setMfaFactorId(mfaStatus.verifiedFactors[0].id);
        setOtpCode('');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal login. Periksa email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    setVerifyingOtp(true);
    setErrorMsg('');

    try {
      await verifyTotpCode(mfaFactorId, otpCode);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setErrorMsg(err.message || 'Kode 2FA tidak valid.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL otentikasi Google tidak ditemukan.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal login dengan Google.');
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative bg-cover bg-center bg-no-repeat py-10"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[3px]"></div>

      <div className="relative z-10 w-full max-w-md px-4 flex flex-col items-center">
        <div className="flex flex-col items-center mb-8 text-center animate-fade-in-down">
          <img
            src="/logo-divisi-infrastruktur.png"
            alt="Logo Divisi Infrastruktur"
            className="w-36 h-36 object-contain mb-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
          />
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            InfraControl <span className="text-indigo-400">PRO</span>
          </h1>
          <p className="text-xs font-semibold text-slate-300 tracking-[0.2em] uppercase mt-2">
            Divisi Infrastruktur
          </p>
        </div>

        <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 p-8 sm:p-10">
          {mfaFactorId ? (
            <form onSubmit={handleVerifyMfa} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
                  <ShieldCheck size={24} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Verifikasi 2FA (Authenticator)</h2>
                <p className="text-xs text-slate-500">
                  Masukkan 6 digit kode OTP dari aplikasi Authenticator Anda untuk melanjutkan.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 text-center font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono text-2xl tracking-[0.45em] focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={verifyingOtp || otpCode.length !== 6}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 disabled:bg-indigo-400"
              >
                {verifyingOtp ? <Loader2 className="animate-spin" size={20} /> : 'Verifikasi & Masuk'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setMfaFactorId(null);
                  setOtpCode('');
                }}
                className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 py-1"
              >
                Kembali ke Halaman Login
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-5">
                {errorMsg && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 text-center font-medium animate-pulse">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                    Alamat Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="nama@perusahaan.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Password
                    </label>
                    <a href="#" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                      Lupa Password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 disabled:bg-indigo-400"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Masuk ke Sistem'}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-4">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Atau Masuk Dengan</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="mt-6 w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="animate-spin text-slate-400" size={20} />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google Workspace / SSO
                  </>
                )}
              </button>

              <div className="mt-8 text-center bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Akses terbatas untuk personel terotorisasi.<br />
                  Mengalami kendala masuk? Hubungi <strong className="text-slate-800">Administrator IT Sistem</strong>.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-[10px] text-slate-400 font-medium space-x-3">
          <span>Kebijakan Privasi</span>
          <span>|</span>
          <span>Syarat &amp; Ketentuan</span>
          <span>|</span>
          <span>© 2026 PT. InfraControl PRO</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-white">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
