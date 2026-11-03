'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Wallet, Loader2, Mail, Lock, ArrowRight, Building2, CheckCircle2, ShieldCheck, TrendingUp } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      router.push('/'); 
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      
      {/* SISI KIRI: BRANDING & FITUR (Hanya tampil di layar besar) */}
      <div className="hidden lg:flex w-1/2 bg-indigo-900 text-white flex-col justify-center px-16 relative overflow-hidden">
        {/* Dekorasi Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
          <div className="absolute top-1/2 -right-24 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <Building2 size={36} className="text-indigo-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">InfraControl <span className="text-indigo-400">PRO</span></h1>
              <p className="text-indigo-200 text-sm tracking-widest uppercase mt-1">Enterprise Construction ERP</p>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-4xl font-bold leading-tight mb-6">
            Kendalikan Proyek Konstruksi Anda dengan <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Presisi Tinggi.</span>
          </h2>
          
          <p className="text-indigo-100 mb-10 text-lg max-w-md leading-relaxed">
            Platform terintegrasi untuk perencanaan, pengendalian biaya, manajemen mutu, dan pelaporan eksekutif proyek infrastruktur dalam satu genggaman.
          </p>

          {/* Daftar Fitur */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="text-emerald-400" size={24} />
              <span className="text-indigo-50 font-medium">Perencanaan WBS & CPM (Critical Path Method)</span>
            </div>
            <div className="flex items-center gap-4">
              <CheckCircle2 className="text-emerald-400" size={24} />
              <span className="text-indigo-50 font-medium">Kontrol Anggaran & Cash Flow (Auto-Rollup)</span>
            </div>
            <div className="flex items-center gap-4">
              <CheckCircle2 className="text-emerald-400" size={24} />
              <span className="text-indigo-50 font-medium">Manajemen Risiko & QHSE (Mutu & K3)</span>
            </div>
            <div className="flex items-center gap-4">
              <CheckCircle2 className="text-emerald-400" size={24} />
              <span className="text-indigo-50 font-medium">Visualisasi S-Curve & Earned Value (EVM)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SISI KANAN: FORM LOGIN */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50 p-6 sm:p-12">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 sm:p-10">
          
          <div className="text-center mb-8">
            {/* Logo Kecil (Mobile) */}
            <div className="lg:hidden flex justify-center mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl">
                <Building2 size={32} className="text-indigo-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Selamat Datang Kembali</h2>
            <p className="text-sm text-slate-500 mt-2">Silakan masuk untuk mengakses dashboard proyek Anda.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 text-center font-medium animate-pulse">
                {errorMsg}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                  placeholder="nama@perusahaan.com" 
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Password</label>
                <a href="#" className="text-xs text-indigo-600 hover:underline font-semibold">Lupa Password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                  placeholder="********" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <><Loader2 size={20} className="animate-spin" /> Memverifikasi...</> : <><ArrowRight size={20} /> Masuk ke Sistem</>}
            </button>
          </form>
          
          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-500">
              Belum punya akses? <br className="sm:hidden" />
              Hubungi <span className="font-bold text-slate-700">Project Manager</span> Anda untuk mendapatkan undangan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}