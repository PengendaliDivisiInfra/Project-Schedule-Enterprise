'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Supabase secara otomatis menangani penukaran kode di latar belakang
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Error during auth callback:", error.message);
        router.push('/login?error=auth_failed');
      } else if (data.session) {
        // Jika sesi berhasil dibuat, arahkan ke dashboard
        router.push('/');
      } else {
        // Jika tidak ada sesi, kembalikan ke login
        router.push('/login');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Menyelesaikan proses autentikasi...</p>
      </div>
    </div>
  );
}