'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';

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
    <div 
      className="min-h-screen w-full flex items-center justify-center relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      {/* Overlay Gelap agar teks dan form lebih menonjol */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"></div>

      {/* Container Form Login (Glassmorphism / Putih Elegan) */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 p-8 sm:p-10 mx-4 animate-scale-in">
        
        {/* Logo Perisai Infrastruktur */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Logo Divisi Infrastruktur" className="w-24 h-24 object-contain mb-4 drop-shadow-lg" />
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">InfraControl <span className="text-indigo-600">PRO</span></h1>
          <p className="text-xs font-semibold text-slate-500 tracking-widest uppercase mt-1">Divisi Infrastruktur</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
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
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <><Loader2 size={20} className="animate-spin" /> Memverifikasi...</> : <><ArrowRight size={20} /> Masuk ke Sistem</>}
          </button>
        </form>
        
        <div className="mt-8 text-center border-t border-slate-200 pt-6">
          <p className="text-xs text-slate-500 font-medium">
            Belum punya akses? <br className="sm:hidden" />
            Hubungi <span className="font-bold text-slate-700">Project Manager</span> Anda untuk mendapatkan undangan.
          </p>
        </div>
      </div>
    </div>
  );
}