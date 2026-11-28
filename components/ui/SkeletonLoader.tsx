export function SkeletonLoader({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const safeRows = Math.max(1, rows);
  const safeCols = Math.max(1, cols);

  return (
    <div className="w-full overflow-hidden rounded-xl">
      <div className="flex items-center gap-4 px-5 py-3.5 bg-slate-50/90 border-b border-slate-200/70">
        {[...Array(safeCols)].map((_, j) => (
          <div
            key={`h-${j}`}
            className={`h-3 rounded enterprise-shimmer ${
              j === 0 ? 'w-1/4' : j === safeCols - 1 ? 'w-20 ml-auto' : 'flex-1'
            }`}
          />
        ))}
      </div>
      <div className="divide-y divide-slate-100 bg-white">
        {[...Array(safeRows)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            {[...Array(safeCols)].map((_, j) => (
              <div
                key={j}
                className={`h-3.5 rounded-md enterprise-shimmer ${
                  j === 0
                    ? 'w-1/4'
                    : j === safeCols - 1
                    ? 'w-20 ml-auto rounded-full h-5'
                    : i % 2 === 0
                    ? 'flex-1'
                    : 'flex-1 opacity-80'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
