import Link from "next/link";
import { format, isAfter, isBefore } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import { NewTripButton } from "./NewTripButton";

export default async function TripsPage() {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();

  const { data: trips } = await supabase
    .from("trips")
    .select("id, name, destination, starts_on, ends_on, color")
    .eq("household_id", householdId)
    .order("starts_on", { ascending: true });

  const today = new Date();
  const upcoming = (trips ?? []).filter((t) => isAfter(new Date(t.ends_on), today));
  const past = (trips ?? []).filter((t) => isBefore(new Date(t.ends_on), today));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700 sm:text-sm">
            Trips
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            ✈️ Where to next
          </h1>
        </div>
        <NewTripButton />
      </header>

      {trips && trips.length > 0 ? (
        <>
          {upcoming.length > 0 ? (
            <section>
              <h2 className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                Upcoming
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {upcoming.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </div>
            </section>
          ) : null}

          {past.length > 0 ? (
            <section>
              <h2 className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                Past
              </h2>
              <div className="grid grid-cols-1 gap-4 opacity-70 sm:grid-cols-2">
                {past.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="card grid place-items-center p-16 text-center">
          <p className="text-4xl" aria-hidden>✈️</p>
          <p className="mt-2 text-sm text-ink-400">No trips yet. Plan one to bundle events + packing list + notes.</p>
        </div>
      )}
    </div>
  );
}

function TripCard({
  trip,
}: {
  trip: {
    id: string;
    name: string;
    destination: string | null;
    starts_on: string;
    ends_on: string;
    color: string;
  };
}) {
  const start = new Date(trip.starts_on);
  const end = new Date(trip.ends_on);
  const daysAway = Math.max(0, Math.ceil((start.getTime() - Date.now()) / 86400000));
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="card group relative flex flex-col gap-3 overflow-hidden p-5 transition hover:brightness-[1.02]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-50"
        style={{ background: `radial-gradient(closest-side, ${trip.color}55, transparent 70%)` }}
      />
      <div className="relative">
        <h2 className="text-lg font-semibold text-ink-900">{trip.name}</h2>
        {trip.destination ? (
          <p className="text-sm text-ink-500">{trip.destination}</p>
        ) : null}
      </div>
      <div className="relative flex items-end justify-between gap-3">
        <p className="text-xs text-ink-400">
          {format(start, "MMM d")} – {format(end, "MMM d, yyyy")}
        </p>
        {daysAway > 0 ? (
          <span className="rounded-full bg-amber-gradient px-2.5 py-0.5 text-[10px] font-semibold text-ink-900">
            in {daysAway}d
          </span>
        ) : null}
      </div>
    </Link>
  );
}
