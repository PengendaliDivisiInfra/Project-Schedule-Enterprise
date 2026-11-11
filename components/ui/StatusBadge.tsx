'use client';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
  let dotClass = 'bg-gray-500';

  switch (status.toLowerCase()) {
    case 'draft':
      colorClass = 'bg-slate-50 text-slate-700 border-slate-200';
      dotClass = 'bg-slate-400';
      break;
    case 'submitted':
      colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
      dotClass = 'bg-blue-500';
      break;
    case 'approved':
    case 'paid':
      colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotClass = 'bg-emerald-500';
      break;
    case 'invoiced':
    case 'partially paid':
      colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
      dotClass = 'bg-amber-500';
      break;
    case 'void':
    case 'rejected':
      colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
      dotClass = 'bg-rose-500';
      break;
    case 'overdue':
      colorClass = 'bg-orange-50 text-orange-700 border-orange-200';
      dotClass = 'bg-orange-500';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotClass}`}></span>
      {status}
    </span>
  );
}