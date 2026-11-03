'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff, Globe } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback'
      }
    });
    if (error) {
      setErrorMsg(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-center relative bg-cover bg-center bg-no-repeat py-10"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      {/* Overlay Gelap */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[3px]"></div>

      {/* Container Utama (Kartu Login & Logo) */}
      <div className="relative z-10 w-full max-w-md px-4 flex flex-col items-center">
        
        {/* Logo & Branding di Luar Kartu (Lebih Megah) */}
        <div className="flex flex-col items-center mb-8 text-center animate-fade-in-down">
          <img src="/logo.png" alt="Logo Divisi Infrastruktur" className="w-36 h-36 object-contain mb-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
          <h1 className="text-3xl font-extrabold text-white tracking-tight">InfraControl <span className="text-indigo-400">PRO</span></h1>
          <p className="text-xs font-semibold text-slate-300 tracking-[0.2em] uppercase mt-2">Divisi Infrastruktur</p>
        </div>

        {/* Kartu Form Glassmorphism */}
        <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 p-8 sm:p-10">
          
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
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                  placeholder="********" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || googleLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <><Loader2 size={20} className="animate-spin" /> Memverifikasi...</> : <><ArrowRight size={20} /> Masuk ke Sistem</>}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 mb-6 flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-semibold uppercase">Atau masuk dengan</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Google SSO Button */}
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            {googleLoading ? (
              <Loader2 size={20} className="animate-spin text-slate-500" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Google Workspace / SSO
          </button>
          
          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-500 font-medium">
              Akses terbatas untuk personel terotorisasi.<br />
              Mengalami kendala masuk? Hubungi <span className="font-bold text-slate-700">Administrator IT Sistem</span>.
            </p>
          </div>
        </div>

        {/* Footer Hukum / Legal */}
        <div className="mt-8 text-center text-xs text-slate-400 space-x-2 animate-fade-in">
          <a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a>
          <span>|</span>
          <a href="#" className="hover:text-white transition-colors">Syarat & Ketentuan</a>
          <span>|</span>
          <span>&copy; 2026 PT. InfraControl PRO</span>
        </div>

      </div>
    </div>
  );
}