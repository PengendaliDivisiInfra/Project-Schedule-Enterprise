'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';import Dashboard from '@/components/Dashboard';
import { LogIn } from 'lucide-react';

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProject(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProject(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProject = async (userId) => {
    const { data } = await supabase.from('projects').select('id').eq('owner_id', userId).limit(1).maybeSingle();
    if (data) setProjectId(data.id);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProjectId('');
  };

  // Tampilan jika belum login
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow border border-slate-200">
          <h1 className="text-2xl font-bold text-center mb-6">ProManage Enterprise</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" className="w-full flex justify-center items-center gap-2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
              <LogIn className="w-4 h-4" />
              {isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 hover:underline">
              {isLogin ? 'Daftar' : 'Masuk'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Tampilan jika sudah login tapi belum ada data project
  if (!projectId) {
    return (
      <div className="text-center mt-20">
        <p className="text-slate-500 mb-4">Anda belum memiliki project di database.</p>
        <p className="text-sm text-slate-400 mb-6">Buka Supabase SQL Editor dan jalankan script Seeding (Langkah 3).</p>
        <button onClick={handleLogout} className="text-red-600 font-medium">Logout</button>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div>
      <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-4">
        <div className="text-sm text-slate-500">Logged in as: <strong className="text-slate-800">{session.user.email}</strong></div>
        <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
      </div>
      <Dashboard projectId={projectId} />
    </div>
  );
}