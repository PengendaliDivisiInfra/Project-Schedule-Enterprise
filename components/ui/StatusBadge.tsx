'use client';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = String(status || '').trim().toLowerCase();

  let colorClass = 'bg-slate-100/80 text-slate-700 border-slate-200/80';
  let dotClass = 'bg-slate-400';
  let pulse = false;

  switch (normalized) {
    case 'draft':
      colorClass = 'bg-slate-50 text-slate-600 border-slate-200';
      dotClass = 'bg-slate-400';
      break;
    case 'submitted':
    case 'ordered':
    case 'in progress':
      colorClass = 'bg-blue-50/90 text-blue-700 border-blue-200/80';
      dotClass = 'bg-blue-500';
      pulse = true;
      break;
    case 'pending':
    case 'pending overbudget':
    case 'invoiced':
    case 'partially paid':
    case 'partial':
      colorClass = 'bg-amber-50/90 text-amber-800 border-amber-200/90';
      dotClass = 'bg-amber-500';
      pulse = normalized.includes('pending');
      break;
    case 'approved':
    case 'paid':
    case 'signed':
    case 'active':
    case 'compliant':
    case 'completed':
    case 'accepted':
    case 'released':
      colorClass = 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80';
      dotClass = 'bg-emerald-500';
      break;
    case 'void':
    case 'voided':
    case 'rejected':
    case 'blacklisted':
    case 'revoked':
    case 'expired':
    case 'overbudget':
      colorClass = 'bg-rose-50/90 text-rose-700 border-rose-200/90';
      dotClass = 'bg-rose-500';
      break;
    case 'overdue':
      colorClass = 'bg-orange-50/90 text-orange-700 border-orange-200/90';
      dotClass = 'bg-orange-500';
      pulse = true;
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${colorClass}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotClass}`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotClass}`} />
      </span>
      {status}
    </span>
  );
}
