'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Wallet, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-scale-in">
        <div className="p-8 text-center bg-indigo-600 text-white">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Wallet size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold">InfraControl PRO</h1>
          <p className="text-indigo-200 text-sm mt-1">Enterprise Project Management</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 text-center font-medium">
              {errorMsg}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Alamat Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                placeholder="nama@perusahaan.com" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                placeholder="********" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Memverifikasi...</> : <><ArrowRight size={18} /> Masuk ke Sistem</>}
          </button>
        </form>
        
        <div className="px-8 pb-8 text-center">
          <p className="text-xs text-slate-500">
            Belum punya akses? Hubungi Project Manager Anda untuk mendapatkan undangan.
          </p>
        </div>
      </div>
    </div>
  );
}