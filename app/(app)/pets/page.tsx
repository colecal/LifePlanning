import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import { NewPetButton } from "./NewPetButton";

export default async function PetsPage() {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();

  // Both queries are scoped by household_id directly (pet_logs carries its
  // own household_id column), so they can run in parallel instead of the
  // logs query waiting on pet ids from the first one.
  const [{ data: pets }, { data: recentLogs }] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, color, breed, birthday")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true }),
    supabase
      .from("pet_logs")
      .select("pet_id, kind, value, at")
      .eq("household_id", householdId)
      .in("kind", ["feeding", "weight", "medication", "walk"])
      .order("at", { ascending: false }),
  ]);

  const lastByKind = new Map<string, Record<string, { value: string | null; at: string }>>();
  for (const log of recentLogs ?? []) {
    if (!lastByKind.has(log.pet_id)) lastByKind.set(log.pet_id, {});
    const m = lastByKind.get(log.pet_id)!;
    if (!m[log.kind]) m[log.kind] = { value: log.value, at: log.at };
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700 sm:text-sm">
            Pets
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            🐾 Sally &amp; Nico
          </h1>
        </div>
        <NewPetButton />
      </header>

      {(pets ?? []).length === 0 ? (
        <div className="card grid place-items-center p-16 text-center">
          <p className="text-4xl">🐕</p>
          <p className="mt-2 text-sm text-ink-400">No pets yet. Add one to start logging.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pets!.map((p) => {
            const last = lastByKind.get(p.id) ?? {};
            return (
              <Link
                key={p.id}
                href={`/pets/${p.id}`}
                className="card group flex flex-col gap-3 p-5 transition hover:brightness-[1.02]"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl shadow-soft"
                    style={{
                      background: `linear-gradient(135deg, ${p.color}cc, ${p.color})`,
                    }}
                    aria-hidden
                  >
                    🐕
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink-900">{p.name}</h2>
                    {p.breed ? (
                      <p className="text-xs text-ink-400">{p.breed}</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <Stat label="Last fed" value={last.feeding} />
                  <Stat label="Last walk" value={last.walk} />
                  <Stat label="Last med" value={last.medication} />
                  <Stat label="Last weight" value={last.weight} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value?: { value: string | null; at: string };
}) {
  return (
    <div className="rounded-lg border border-ink-700/8 bg-cream-50/40 px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-ink-800">
        {value ? formatAgo(value.at) : "—"}
      </p>
      {value?.value ? (
        <p className="text-[10px] text-ink-400">{value.value}</p>
      ) : null}
    </div>
  );
}

function formatAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins < 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
