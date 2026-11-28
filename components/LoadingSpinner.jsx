'use client';

export default function LoadingSpinner({ text = 'Memuat data proyek...' }) {
  return (
    <div className="relative flex flex-col w-full min-h-[380px] p-6 space-y-6 animate-in fade-in duration-300">
      {/* Executive Header Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl enterprise-shimmer shrink-0" />
          <div className="space-y-2.5">
            <div className="w-56 h-4 rounded-md enterprise-shimmer" />
            <div className="w-80 max-w-[55vw] h-3 rounded-md enterprise-shimmer" />
          </div>
        </div>
        <div className="hidden sm:block w-36 h-10 rounded-xl enterprise-shimmer" />
      </div>

      {/* Executive KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
            <div className="w-28 h-3 rounded enterprise-shimmer" />
            <div className="w-44 h-6 rounded-md enterprise-shimmer" />
            <div className="w-32 h-2.5 rounded enterprise-shimmer" />
          </div>
        ))}
      </div>

      {/* Executive Table Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="h-11 bg-slate-50 border-b border-slate-200/70 px-5 flex items-center gap-6">
          <div className="w-24 h-3 rounded enterprise-shimmer" />
          <div className="w-40 h-3 rounded enterprise-shimmer" />
          <div className="w-28 h-3 rounded enterprise-shimmer ml-auto" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center gap-5">
              <div className="w-24 h-3.5 rounded enterprise-shimmer" />
              <div className="flex-1 h-3.5 rounded enterprise-shimmer" />
              <div className="w-28 h-3.5 rounded enterprise-shimmer" />
              <div className="w-20 h-6 rounded-full enterprise-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Floating Executive Status Pill */}
      <div className="flex justify-center pt-1">
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/95 backdrop-blur-md border border-indigo-100 shadow-executive">
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent animate-spin" />
          </span>
          <span className="text-xs font-bold tracking-wide text-slate-600">{text}</span>
        </div>
      </div>
    </div>
  );
}
