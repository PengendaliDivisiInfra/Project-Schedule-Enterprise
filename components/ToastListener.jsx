'use client';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export default function ToastListener() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, ...e.detail }]);
      
      // Hapus otomatis setelah 5 detik
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    };

    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div 
          key={t.id} 
          className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border min-w-[300px] max-w-md animate-in slide-in-from-right-8 fade-in duration-300 ${
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
            t.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 
            'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {t.type === 'error' ? <AlertCircle className="shrink-0" size={20} /> : 
           t.type === 'warning' ? <Info className="shrink-0" size={20} /> : 
           <CheckCircle className="shrink-0" size={20} />}
          
          <div className="flex-1 text-sm font-medium">{t.message}</div>
          <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="opacity-50 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}