export default function Loading() {
  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-20 animate-pulse rounded-full bg-ink-200/40" />
        <div className="h-10 w-56 animate-pulse rounded-lg bg-ink-200/40" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-28 animate-pulse rounded-xl bg-ink-200/30" />
        <div className="h-9 w-24 animate-pulse rounded-xl bg-ink-200/30" />
        <div className="h-9 w-24 animate-pulse rounded-xl bg-ink-200/30" />
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-ink-700/8">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse bg-ink-200/10" />
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="min-h-[4rem] sm:min-h-[6.5rem] border-b border-r border-ink-700/6 p-2">
              <div className="h-5 w-5 animate-pulse rounded-full bg-ink-200/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
