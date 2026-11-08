'use client';

import React, { useState, useEffect } from 'react';
import { coaService } from '@/lib/services/coa.service';
import { COA, SAKCategory, SaldoNormal } from '@/lib/types/coa';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: COA | null;
  onSuccess: () => void;
}

export default function COAModal({ isOpen, onClose, initialData, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    kode_akun: '',
    nama_akun: '',
    kategori_sak: 'Aset Lancar' as SAKCategory,
    saldo_normal: 'Debit' as SaldoNormal,
    per_mandor: false,
    status: 'Aktif' as 'Aktif' | 'Inaktif'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        kode_akun: initialData.kode_akun,
        nama_akun: initialData.nama_akun,
        kategori_sak: initialData.kategori_sak,
        saldo_normal: initialData.saldo_normal,
        per_mandor: initialData.per_mandor,
        status: initialData.status,
      });
    } else {
      setFormData({
        kode_akun: '', nama_akun: '', kategori_sak: 'Aset Lancar', saldo_normal: 'Debit', per_mandor: false, status: 'Aktif'
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (initialData?.id) {
        await coaService.updateCOA(initialData.id, formData);
      } else {
        await coaService.createCOA(formData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      // Sesuai aturan, jangan pakai alert. Gunakan state error / toast component
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{initialData ? 'Edit Akun' : 'Tambah Akun Baru'}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kode Akun (4 Digit)</label>
            <input type="text" required maxLength={10} value={formData.kode_akun} onChange={e => setFormData({...formData, kode_akun: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="Contoh: 1111" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Akun</label>
            <input type="text" required value={formData.nama_akun} onChange={e => setFormData({...formData, nama_akun: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="Contoh: Kas dan Bank Proyek" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategori SAK</label>
            <select value={formData.kategori_sak} onChange={e => setFormData({...formData, kategori_sak: e.target.value as SAKCategory})} className="w-full border rounded p-2 text-sm">
              <option value="Aset Lancar">Aset Lancar</option>
              <option value="Aset Tetap">Aset Tetap</option>
              <option value="Liabilitas Jangka Pendek">Liabilitas Jangka Pendek</option>
              <option value="Liabilitas Jangka Panjang">Liabilitas Jangka Panjang</option>
              <option value="Ekuitas">Ekuitas</option>
              <option value="Pendapatan">Pendapatan</option>
              <option value="Beban Pokok Proyek">Beban Pokok Proyek</option>
              <option value="Beban Operasional">Beban Operasional</option>
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Saldo Normal</label>
              <select value={formData.saldo_normal} onChange={e => setFormData({...formData, saldo_normal: e.target.value as SaldoNormal})} className="w-full border rounded p-2 text-sm">
                <option value="Debit">Debit</option>
                <option value="Kredit">Kredit</option>
              </select>
            </div>
            <div className="flex-1 flex items-center mt-6">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={formData.per_mandor} onChange={e => setFormData({...formData, per_mandor: e.target.checked})} className="w-4 h-4" />
                Per Mandor?
              </label>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm hover:bg-gray-50" disabled={isLoading}>Batal</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700" disabled={isLoading}>
              {isLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}