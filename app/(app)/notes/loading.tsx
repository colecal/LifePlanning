export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <div className="h-3 w-16 animate-pulse rounded-full bg-ink-200/40" />
        <div className="mt-2 h-10 w-72 animate-pulse rounded-lg bg-ink-200/40" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_1fr]">
        <div className="card h-64 animate-pulse" />
        <div className="card h-96 animate-pulse" />
      </div>
    </div>
  );
}
