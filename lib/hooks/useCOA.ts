import { useState, useEffect } from 'react';
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

  const getAccountCode = (nameKeyword: string) => {
    return coas.find(c => c.nama_akun.toLowerCase().includes(nameKeyword.toLowerCase()))?.kode_akun || '';
  };

  const getMandorAccounts = () => {
    return coas.filter(c => c.per_mandor && c.status === 'Aktif');
  };

  return { coas, loading, getAccountCode, getMandorAccounts };
};