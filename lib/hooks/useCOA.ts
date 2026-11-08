import { useState, useEffect, useCallback } from 'react';
import { coaService } from '../services/coa.service';
import { COA } from '../types/coa';

export const useCOA = () => {
  const [coas, setCoas] = useState<COA[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coaService.getActiveCOAs().then(data => {
      setCoas(data);
      setLoading(false);
    });
  }, []);

  // BUNGKUS DENGAN useCallback AGAR REFERENSI FUNGSI TIDAK BERUBAH SETIAP RENDER
  const getAccountCode = useCallback((nameKeyword: string) => {
    return coas.find(c => c.nama_akun.toLowerCase().includes(nameKeyword.toLowerCase()))?.kode_akun || '';
  }, [coas]); // Hanya berubah jika data 'coas' berubah

  const getMandorAccounts = useCallback(() => {
    return coas.filter(c => c.per_mandor && c.status === 'Aktif');
  }, [coas]);

  return { coas, loading, getAccountCode, getMandorAccounts };
};