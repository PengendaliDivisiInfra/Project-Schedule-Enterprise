import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="w-24 h-24 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <WifiOff size={48} />
      </div>
      <h1 className="text-3xl font-black text-slate-800 mb-3">Anda Sedang Offline</h1>
      <p className="text-slate-500 max-w-md mb-8">
        Koneksi internet terputus. Namun, jangan khawatir! Anda masih bisa membuka menu yang sudah pernah dikunjungi, atau mengisi form Progres Harian yang akan disinkronkan otomatis saat online.
      </p>
      <Link 
        href="/dashboard" 
        className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
      >
        Coba Kembali ke Dasbor
      </Link>
    </div>
  );
}