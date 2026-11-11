'use client';

import { useRole } from '@/lib/hooks/useRole';

interface MoneyTextProps {
  value: number | string | undefined | null;
  className?: string;
  showMask?: boolean;
}

export function MoneyText({ value, className = '', showMask }: MoneyTextProps) {
  const { can } = useRole();
  const isAllowedToSeePrice = can('VIEW_PRICE');
  
  if (!isAllowedToSeePrice || showMask) {
    return <span className={`tabular-nums ${className}`}>Rp ***</span>;
  }

  const safeValue = isNaN(Number(value)) ? 0 : Number(value);

  return (
    <span className={`tabular-nums ${className}`}>
      {new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(safeValue)}
    </span>
  );
}