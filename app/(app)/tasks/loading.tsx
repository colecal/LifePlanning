export default function Loading() {
  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <div className="h-3 w-16 animate-pulse rounded-full bg-ink-200/40" />
        <div className="mt-2 h-10 w-64 animate-pulse rounded-lg bg-ink-200/40" />
      </div>
      <div className="card h-24 animate-pulse" />
      <div className="card flex flex-col divide-y divide-ink-700/6 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-5 w-5 animate-pulse rounded-md bg-ink-200/30" />
            <div className="h-4 flex-1 animate-pulse rounded-md bg-ink-200/30" style={{ maxWidth: `${50 + (i * 7) % 30}%` }} />
            <div className="h-5 w-16 animate-pulse rounded-md bg-ink-200/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
