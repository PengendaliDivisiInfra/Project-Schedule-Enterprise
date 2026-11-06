'use client';

import { useRole } from '@/lib/hooks/useRole';

interface MoneyTextProps {
  value: number;
  className?: string;
  showMask?: boolean; // paksa mask (opsional)
}

export function MoneyText({ value, className = '', showMask }: MoneyTextProps) {
  const { can } = useRole();
  const isAllowedToSeePrice = can('VIEW_PRICE');
  
  // Jika user tidak punya akses ATAU showMask diset true
  if (!isAllowedToSeePrice || showMask) {
    return <span className={className}>Rp ***</span>;
  }

  return (
    <span className={className}>
      {new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value)}
    </span>
  );
}