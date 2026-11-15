'use client';

import { useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Terjadi error navigasi:", error);
  }, [error]);

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${isOffline ? 'bg-amber-100 text-amber-500' : 'bg-rose-100 text-rose-500'}`}>
        {isOffline ? <WifiOff size={48} /> : <RefreshCw size={48} />}
      </div>
      
      <h1 className="text-2xl font-black text-slate-800 mb-3">
        {isOffline ? 'Koneksi Terputus' : 'Terjadi Kesalahan'}
      </h1>
      
      <p className="text-slate-500 max-w-md mb-8">
        {isOffline 
          ? 'Anda sedang offline dan halaman ini belum pernah dibuka sebelumnya (belum tersimpan di cache). Silakan kembali ke halaman yang sudah dikunjungi atau sambungkan kembali internet Anda.'
          : 'Maaf, terjadi kesalahan saat memuat halaman ini. Silakan coba beberapa saat lagi.'}
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
        >
          Coba Lagi
        </button>
        
        <Link 
          href="/dashboard" 
          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
        >
          Kembali ke Dasbor
        </Link>
      </div>
    </div>
  );
}