'use client';

import { SignatureItem } from '@/lib/types/subcon';

interface Props {
  signatures: SignatureItem[];
  onChange: (newSignatures: SignatureItem[]) => void;
  colorTheme?: 'teal' | 'emerald' | 'blue'; // Menyesuaikan warna modul
}

export function SignatureSettings({ signatures, onChange, colorTheme = 'teal' }: Props) {
  const focusColor = colorTheme === 'emerald' ? 'focus:ring-emerald-500' : colorTheme === 'blue' ? 'focus:ring-blue-500' : 'focus:ring-teal-500';

  const handleNameChange = (index: number, newName: string) => {
    const newSigs = [...signatures];
    newSigs[index].name = newName;
    onChange(newSigs);
  };

  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-lg border animate-in fade-in slide-in-from-top-2">
      <h4 className="font-bold text-sm mb-3 text-slate-800">Daftar Penandatangan (Bisa Diedit)</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {signatures.map((sig, idx) => (
          <div key={idx}>
            <label className="block text-xs font-bold text-slate-600 mb-1">{sig.title}</label>
            <input 
              type="text" 
              value={sig.name} 
              onChange={(e) => handleNameChange(idx, e.target.value)} 
              className={`w-full border rounded p-2 text-sm outline-none focus:ring-2 ${focusColor}`} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}