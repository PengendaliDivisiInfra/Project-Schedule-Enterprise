export function SkeletonLoader({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-slate-100">
          {[...Array(cols)].map((_, j) => (
            <div key={j} className={`h-4 bg-slate-200 rounded ${j === 0 ? 'w-1/4' : j === cols - 1 ? 'w-1/6 ml-auto' : 'flex-1'}`}></div>
          ))}
        </div>
      ))}
    </div>
  );
}