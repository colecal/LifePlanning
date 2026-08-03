export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-14 animate-pulse rounded-full bg-ink-200/40" />
          <div className="h-9 w-48 animate-pulse rounded-lg bg-ink-200/40" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-xl bg-ink-200/30" />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card flex flex-col gap-3 p-5">
            <div className="flex flex-col gap-2">
              <div className="h-5 w-32 animate-pulse rounded-md bg-ink-200/40" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-ink-200/30" />
            </div>
            <div className="flex items-end justify-between gap-3 pt-2">
              <div className="h-3 w-28 animate-pulse rounded-full bg-ink-200/30" />
              <div className="h-5 w-14 animate-pulse rounded-full bg-ink-200/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
