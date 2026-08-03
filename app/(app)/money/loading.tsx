export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 animate-pulse rounded-full bg-ink-200/40" />
        <div className="h-9 w-48 animate-pulse rounded-lg bg-ink-200/40" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card flex flex-col gap-3 p-5">
            <div className="h-3 w-20 animate-pulse rounded-full bg-ink-200/40" />
            <div className="h-8 w-28 animate-pulse rounded-lg bg-ink-200/40" />
            <div className="h-2 w-full animate-pulse rounded-full bg-ink-200/20" />
          </div>
        ))}
      </div>

      <div className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-ink-200/30" />
            <div
              className="h-4 flex-1 animate-pulse rounded-md bg-ink-200/30"
              style={{ maxWidth: `${50 + ((i * 7) % 30)}%` }}
            />
            <div className="h-4 w-14 animate-pulse rounded-md bg-ink-200/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
