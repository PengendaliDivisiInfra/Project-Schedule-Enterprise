'use client';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let colorClass = 'bg-gray-100 text-gray-800 border-gray-200';

  switch (status.toLowerCase()) {
    case 'draft':
      colorClass = 'bg-slate-100 text-slate-700 border-slate-300';
      break;
    case 'submitted':
      colorClass = 'bg-blue-100 text-blue-800 border-blue-300';
      break;
    case 'approved':
    case 'paid':
      colorClass = 'bg-green-100 text-green-800 border-green-300';
      break;
    case 'invoiced':
    case 'partially paid':
      colorClass = 'bg-amber-100 text-amber-800 border-amber-300';
      break;
    case 'void':
    case 'rejected':
      colorClass = 'bg-red-100 text-red-800 border-red-300';
      break;
    case 'overdue':
      colorClass = 'bg-orange-100 text-orange-800 border-orange-300';
      break;
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
      {status}
    </span>
  );
}