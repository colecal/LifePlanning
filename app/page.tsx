import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, color")
    .eq("id", user!.id)
    .single();

  const { data: members } = await supabase
    .from("household_members")
    .select("profile_id, profiles(display_name, color)")
    .order("joined_at", { ascending: true });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 font-sans">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: profile?.color ?? "#3b82f6" }}
        />
        <h1 className="text-3xl font-semibold tracking-tight">
          hola, {profile?.display_name ?? user!.email}
        </h1>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 font-medium">Household members</p>
        <ul className="flex flex-col gap-1">
          {members?.map((m) => {
            const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return (
              <li key={m.profile_id} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: p?.color ?? "#3b82f6" }}
                />
                {p?.display_name ?? m.profile_id}
              </li>
            );
          })}
        </ul>
      </div>

      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </form>

      <p className="text-xs text-zinc-400">Phase 1 complete · calendar, lists, notes coming next</p>
    </main>
  );
}
