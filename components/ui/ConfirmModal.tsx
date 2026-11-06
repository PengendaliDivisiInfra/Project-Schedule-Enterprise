'use client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, isLoading }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-600 text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50" disabled={isLoading}>Batal</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" disabled={isLoading}>
            {isLoading ? 'Memproses...' : 'Ya, Lanjutkan'}
          </button>
        </div>
      </div>
    </div>
  );
}