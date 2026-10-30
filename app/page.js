'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Dashboard from '@/components/Dashboard';
import { LogIn, Loader2, Building2, ShieldCheck } from 'lucide-react';

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('');
  
  // State untuk UI Loading
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Cek Sesi Awal
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProject(session.user.id);
      setLoadingAuth(false);
    });

    // Listener Perubahan Autentikasi (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProject(session.user.id);
      else setProjectId('');
    });

    return () => subscription.unsubscribe();
  }, []);

  // PERUBAHAN PENTING: Ambil Project melalui tabel project_members (Skema Enterprise)
  const fetchProject = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      
      if (data && data.project_id) {
        setProjectId(data.project_id);
      }
    } catch (err) {
      console.error("Gagal mengambil data project:", err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const { error } = isLogin
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
        
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat autentikasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProjectId('');
  };

  // ─────────────────────────────────────────────────────────────────
  // UI: LOADING STATE (Mencegah layar berkedip)
  // ─────────────────────────────────────────────────────────────────
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
          <p className="text-sm font-medium">Memuat Sesi Enterprise...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // UI: HALAMAN LOGIN / REGISTER
  // ─────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen flex bg-slate-50">
        {/* Panel Kiri: Branding */}
        <div className="hidden lg:flex w-1/2 bg-slate-900 text-white flex-col justify-center items-center p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="relative z-10 text-center space-y-6">
            <ShieldCheck className="w-20 h-20 mx-auto text-blue-500" />
            <h1 className="text-4xl font-bold tracking-tight">ProManage Enterprise</h1>
            <p className="text-lg text-slate-400 max-w-md">
              Platform Manajemen Penjadwalan Konstruksi & Analisis Harga Satuan Pekerjaan (AHSP) PUPR berbasis Cloud.
            </p>
          </div>
        </div>

        {/* Panel Kanan: Form Login */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                {isLogin ? 'Masuk ke Workspace' : 'Buat Akun Baru'}
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                {isLogin ? 'Silakan masukkan kredensial Anda.' : 'Daftar untuk memulai manajemen proyek.'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Perusahaan</label>
                <input
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                  required
                />
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-70 transition-all font-medium"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {isSubmitting ? 'Memproses...' : (isLogin ? 'Sign In' : 'Sign Up')}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              {isLogin ? "Belum memiliki akses? " : "Sudah memiliki akun? "}
              <button 
                onClick={() => { setIsLogin(!isLogin); setError(''); }} 
                className="text-blue-600 font-semibold hover:underline"
              >
                {isLogin ? 'Daftar Sekarang' : 'Masuk di sini'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // UI: JIKA LOGIN TAPI BELUM PUNYA PROJECT
  // ─────────────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Proyek Tidak Ditemukan</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Akun <strong>{session.user.email}</strong> belum terhubung ke proyek manapun. 
            Silakan hubungi Administrator atau jalankan skrip inisialisasi database.
          </p>
          <button 
            onClick={handleLogout} 
            className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Logout & Coba Akun Lain
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // UI: RENDER DASHBOARD UTAMA
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Kita oper userEmail ke Dashboard agar bisa ditampilkan di Header */}
      <Dashboard projectId={projectId} userEmail={session.user.email} onLogout={handleLogout} />
    </div>
  );
}