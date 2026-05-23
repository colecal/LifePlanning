import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import { NewListForm } from "./NewListForm";

export default async function ListsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();
  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, kind")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-700">
          Lists
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          What we&apos;re working on
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_1fr]">
        <aside className="card flex flex-col gap-3 p-4">
          <h2 className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            Your lists
          </h2>
          <ul className="flex flex-col gap-0.5">
            {(lists ?? []).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lists/${l.id}`}
                  className="group flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-ink-700 transition hover:bg-cream-100/70"
                >
                  <span className="truncate font-medium">{l.name}</span>
                  <span className="ml-2 shrink-0 rounded-full bg-amber-50/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700">
                    {l.kind}
                  </span>
                </Link>
              </li>
            ))}
            {(lists ?? []).length === 0 ? (
              <li className="px-2.5 py-2 text-sm text-ink-300">No lists yet.</li>
            ) : null}
          </ul>
          <NewListForm />
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}
