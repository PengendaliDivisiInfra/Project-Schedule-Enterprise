'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/dashboard'); // Arahkan ke Dashboard jika sudah login
      } else {
        router.push('/login');     // Arahkan ke Login jika belum
      }
    };
    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
      <h2 className="text-lg font-bold text-slate-700">Mengalihkan ke Dashboard...</h2>
    </div>
  );
}