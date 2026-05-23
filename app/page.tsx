import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("now_check");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 font-sans">
      <h1 className="text-4xl font-semibold tracking-tight">mi vida loca</h1>
      <p className="text-zinc-500">Phase 0 health check</p>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900">
        {error ? (
          <span className="text-red-600">Supabase error: {error.message}</span>
        ) : (
          <span className="text-emerald-600">
            Supabase OK — server time: {String(data)}
          </span>
        )}
      </div>
    </main>
  );
}
