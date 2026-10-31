'use client';

export default function LoadingSpinner({ text = "Memuat data..." }) {
  return (
    <div className="flex flex-col w-full h-full min-h-[300px] p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
        <div className="w-48 h-4 bg-slate-200 rounded"></div>
      </div>
      <div className="space-y-4 w-full">
        <div className="w-full h-12 bg-slate-100 rounded-lg"></div>
        <div className="w-full h-12 bg-slate-100 rounded-lg"></div>
        <div className="w-full h-12 bg-slate-100 rounded-lg"></div>
        <div className="w-3/4 h-12 bg-slate-100 rounded-lg"></div>
      </div>
      <div className="mt-8 flex justify-center text-slate-400 text-sm font-medium">
        {text}
      </div>
    </div>
  );
}
