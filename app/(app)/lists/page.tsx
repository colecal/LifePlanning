export default function ListsPage() {
  return <ComingSoon name="Lists" />;
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
      <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">{name}</p>
      <p className="mt-1">Coming in the next phase.</p>
    </div>
  );
}
