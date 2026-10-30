'use client';
export default function LoadingSpinner({ text = "Memuat data..." }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 w-full h-full min-h-[300px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-500 font-medium animate-pulse">{text}</p>
    </div>
  );
}
