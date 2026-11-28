'use client';
import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Loader2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
}

const VARIANT_STYLES = {
  danger: {
    ring: 'bg-rose-50 ring-8 ring-rose-50/70 border border-rose-200/70',
    iconColor: 'text-rose-600',
    btn: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/25',
    accent: 'from-rose-500 via-red-500 to-orange-500',
    Icon: AlertTriangle,
  },
  warning: {
    ring: 'bg-amber-50 ring-8 ring-amber-50/70 border border-amber-200/70',
    iconColor: 'text-amber-600',
    btn: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/25',
    accent: 'from-amber-500 via-orange-500 to-yellow-500',
    Icon: ShieldAlert,
  },
  info: {
    ring: 'bg-indigo-50 ring-8 ring-indigo-50/70 border border-indigo-200/70',
    iconColor: 'text-indigo-600',
    btn: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/25',
    accent: 'from-indigo-500 via-blue-500 to-cyan-500',
    Icon: Info,
  },
  success: {
    ring: 'bg-emerald-50 ring-8 ring-emerald-50/70 border border-emerald-200/70',
    iconColor: 'text-emerald-600',
    btn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25',
    accent: 'from-emerald-500 via-teal-500 to-cyan-500',
    Icon: CheckCircle2,
  },
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isLoading = false,
  variant = 'danger',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const theme = VARIANT_STYLES[variant] || VARIANT_STYLES.danger;
  const IconComp = theme.Icon;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => !isLoading && onClose()}
    >
      <div
        className="relative bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden border border-slate-200/80 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${theme.accent}`} />

        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Tutup dialog"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-7 pt-8 pb-6 text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl mb-5 ${theme.ring}`}>
            <IconComp className={`h-7 w-7 ${theme.iconColor}`} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight mb-2">{title}</h2>
          <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
        </div>

        <div className="bg-slate-50/90 px-6 py-4 flex items-center gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300/90 rounded-xl hover:bg-slate-100/80 transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${theme.btn}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
