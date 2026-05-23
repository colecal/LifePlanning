export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded-full bg-ink-200/40" />
        <div className="h-10 w-72 animate-pulse rounded-lg bg-ink-200/40" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card flex flex-col gap-3 p-5">
            <div className="h-3 w-16 animate-pulse rounded-full bg-ink-200/40" />
            <div className="flex flex-col gap-2 pt-2">
              <div className="h-4 w-full animate-pulse rounded-md bg-ink-200/30" />
              <div className="h-4 w-4/5 animate-pulse rounded-md bg-ink-200/30" />
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-ink-200/30" />
            </div>
          </div>
        ))}
      </div>

      <div className="card flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 animate-pulse rounded-full bg-ink-200/40" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-ink-200/30" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-ink-200/40" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-ink-200/40" />
        </div>
      </div>
    </div>
  );
}
