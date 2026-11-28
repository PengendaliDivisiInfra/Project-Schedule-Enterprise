'use client';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

const TOAST_THEMES = {
  success: {
    title: 'Berhasil',
    container: 'bg-white/95 border-emerald-200/90 text-slate-800',
    stripe: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70',
    bar: 'bg-emerald-500/80',
    Icon: CheckCircle2,
  },
  error: {
    title: 'Gagal Diproses',
    container: 'bg-white/95 border-rose-200/90 text-slate-800',
    stripe: 'bg-rose-500',
    iconBg: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/70',
    bar: 'bg-rose-500/80',
    Icon: AlertCircle,
  },
  danger: {
    title: 'Perhatian',
    container: 'bg-white/95 border-rose-200/90 text-slate-800',
    stripe: 'bg-rose-500',
    iconBg: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/70',
    bar: 'bg-rose-500/80',
    Icon: AlertCircle,
  },
  warning: {
    title: 'Peringatan',
    container: 'bg-white/95 border-amber-200/90 text-slate-800',
    stripe: 'bg-amber-500',
    iconBg: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/70',
    bar: 'bg-amber-500/80',
    Icon: AlertTriangle,
  },
  info: {
    title: 'Informasi Sistem',
    container: 'bg-white/95 border-indigo-200/90 text-slate-800',
    stripe: 'bg-indigo-500',
    iconBg: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/70',
    bar: 'bg-indigo-500/80',
    Icon: Info,
  },
};

export default function ToastListener() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const detail = e.detail || {};
      setToasts((prev) => [...prev.slice(-3), { id, ...detail }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    };

    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[10000] flex flex-col gap-2.5 pointer-events-none max-w-[calc(100vw-2.5rem)]">
      {toasts.map((t) => {
        const theme = TOAST_THEMES[t.type] || TOAST_THEMES.info;
        const IconComp = theme.Icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl shadow-executive min-w-[300px] max-w-md animate-in slide-in-from-right-8 fade-in duration-300 ${theme.container}`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.stripe}`} />

            <div className={`p-2 rounded-xl shrink-0 ml-1 ${theme.iconBg}`}>
              <IconComp size={18} />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                {t.title || theme.title}
              </div>
              <div className="text-sm font-semibold text-slate-800 leading-snug mt-0.5 break-words">
                {t.message}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              aria-label="Tutup notifikasi"
            >
              <X size={15} />
            </button>

            <div className={`absolute bottom-0 left-0 right-0 h-[3px] toast-progress-bar ${theme.bar}`} />
          </div>
        );
      })}
    </div>
  );
}
