import Link from "next/link";
import { getHouseholdMembers } from "@/lib/data";

export default async function HomePage() {
  const members = await getHouseholdMembers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-sm text-zinc-500">
          Your daily snapshot lives here. Coming together as features land.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Household
        </h2>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              {m.display_name}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Jump in
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/calendar"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Open calendar
          </Link>
        </div>
      </section>
    </div>
  );
}
